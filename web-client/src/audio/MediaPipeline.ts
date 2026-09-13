import { SpatialAudioPipeline } from './SpatialAudioPipeline.js';

export interface AudioEmitterState {
  id: string;
  source: string;
  mediaUrl: string;
  spatial: boolean;
  world?: string;
  position?: { x: number; y: number; z: number };
  radius: number;
  state: 'PLAYING' | 'PAUSED' | 'STOPPED';
  startedAt: number;
  pausedAt?: number;
  duration?: number;
  loop: boolean;
  volume: number;
  speakerBlockId?: string;
}

export interface EmitterSpatialUpdate {
  type: 'emitter_spatial_update';
  id: string;
  inRange: boolean;
  distance: number;
  relX: number;
  relY: number;
  relZ: number;
}

interface ActiveEmitterAudio {
  emitter: AudioEmitterState;
  audioEl: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode;
  gainNode: GainNode;
  pannerNode?: PannerNode;
  inRange: boolean;
  isPlaying: boolean;
}

export class MediaPipeline {
  private pipeline: SpatialAudioPipeline;
  private wsSend?: (data: any) => void;
  private emitters = new Map<string, ActiveEmitterAudio>();
  private clockOffset = 0;
  private hasSyncedClock = false;
  private syncInterval?: ReturnType<typeof setInterval>;

  constructor(pipeline: SpatialAudioPipeline, wsSend?: (data: any) => void) {
    this.pipeline = pipeline;
    this.wsSend = wsSend;

    this.startClockSync();
  }

  public setWsSend(sendFn: (data: any) => void): void {
    this.wsSend = sendFn;
    this.requestTimeSync();
  }

  public startClockSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.requestTimeSync();
    this.syncInterval = setInterval(() => {
      this.requestTimeSync();
    }, 30000);
  }

  public requestTimeSync(): void {
    if (this.wsSend) {
      this.wsSend({
        type: 'time_sync',
        clientTime: Date.now(),
      });
    }
  }

  public handleTimeSyncResponse(msg: { clientTime: number; serverTime: number }): void {
    const clientNow = Date.now();
    const rtt = Math.max(0, clientNow - msg.clientTime);
    this.clockOffset = msg.serverTime - (msg.clientTime + rtt / 2);
    this.hasSyncedClock = true;
  }

  public getClockOffset(): number {
    return this.clockOffset;
  }

  public isClockSynced(): boolean {
    return this.hasSyncedClock;
  }

  public handleAudioState(emitters: AudioEmitterState[]): void {
    const newIds = new Set(emitters.map((e) => e.id));

    // Remove emitters no longer present in server state
    for (const id of this.emitters.keys()) {
      if (!newIds.has(id)) {
        this.destroyEmitter(id);
      }
    }

    // Add or update emitters
    for (const emitter of emitters) {
      this.upsertEmitter(emitter);
    }
  }

  public handleAudioEvent(event: string, emitter: AudioEmitterState): void {
    switch (event) {
      case 'start':
      case 'resume':
        this.upsertEmitter(emitter);
        break;
      case 'pause': {
        const active = this.emitters.get(emitter.id);
        if (active) {
          active.emitter = emitter;
          active.audioEl.pause();
          active.isPlaying = false;
        }
        break;
      }
      case 'volume': {
        const active = this.emitters.get(emitter.id);
        if (active) {
          active.emitter = emitter;
          const ctx = this.pipeline.getContext();
          active.gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1.0, emitter.volume)), ctx.currentTime, 0.03);
        }
        break;
      }
      case 'stop':
        this.destroyEmitter(emitter.id);
        break;
    }
  }

  public handleSpatialUpdate(update: EmitterSpatialUpdate): void {
    const active = this.emitters.get(update.id);
    if (!active) return;

    active.inRange = update.inRange;
    const ctx = this.pipeline.getContext();

    if (active.pannerNode) {
      this.setPannerPosition(active.pannerNode, update.relX, update.relY, update.relZ, ctx.currentTime);
    }

    if (update.inRange) {
      if (!active.isPlaying && active.emitter.state === 'PLAYING') {
        this.seekAndPlay(active);
      }
    } else {
      // Out of audible range: pause <audio> to conserve browser CPU and audio decoding
      if (active.isPlaying) {
        active.audioEl.pause();
        active.isPlaying = false;
      }
    }
  }

  private upsertEmitter(emitter: AudioEmitterState): void {
    let active = this.emitters.get(emitter.id);
    if (active) {
      active.emitter = emitter;
      active.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1.0, emitter.volume)), this.pipeline.getContext().currentTime);
      if (emitter.state === 'PAUSED') {
        active.audioEl.pause();
        active.isPlaying = false;
      } else if (emitter.state === 'PLAYING' && (active.inRange || !emitter.spatial)) {
        this.seekAndPlay(active);
      }
      return;
    }

    // Create new audio element and Web Audio nodes
    if (typeof document === 'undefined') return;

    const audioEl = document.createElement('audio');
    audioEl.crossOrigin = 'anonymous';
    audioEl.preload = 'auto';
    audioEl.loop = Boolean(emitter.loop);

    // Resolve URL: relative to host or absolute
    audioEl.src = emitter.mediaUrl;

    const ctx = this.pipeline.getContext();
    const sourceNode = ctx.createMediaElementSource(audioEl);
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1.0, emitter.volume)), ctx.currentTime);

    let pannerNode: PannerNode | undefined;
    const mediaBus = this.pipeline.getMediaBusNode();

    if (emitter.spatial) {
      pannerNode = ctx.createPanner();
      pannerNode.panningModel = 'HRTF';
      pannerNode.distanceModel = 'linear';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = Math.max(1, emitter.radius);
      pannerNode.rolloffFactor = 1;

      sourceNode.connect(gainNode);
      gainNode.connect(pannerNode);
      pannerNode.connect(mediaBus);
    } else {
      // Global 2D Broadcast
      sourceNode.connect(gainNode);
      gainNode.connect(mediaBus);
    }

    const newActive: ActiveEmitterAudio = {
      emitter,
      audioEl,
      sourceNode,
      gainNode,
      pannerNode,
      inRange: !emitter.spatial, // 2D broadcast is always in range
      isPlaying: false,
    };

    this.emitters.set(emitter.id, newActive);

    if (emitter.state === 'PLAYING' && (newActive.inRange || !emitter.spatial)) {
      this.seekAndPlay(newActive);
    }
  }

  private seekAndPlay(active: ActiveEmitterAudio): void {
    if (active.emitter.state !== 'PLAYING') return;

    const nowServer = Date.now() + this.clockOffset;
    const elapsedSeconds = Math.max(0, (nowServer - active.emitter.startedAt) / 1000);

    if (active.emitter.duration && active.emitter.duration > 0) {
      const seekTarget = active.emitter.loop
        ? elapsedSeconds % active.emitter.duration
        : elapsedSeconds;

      if (seekTarget < active.emitter.duration) {
        try {
          if (Math.abs(active.audioEl.currentTime - seekTarget) > 0.3) {
            active.audioEl.currentTime = seekTarget;
          }
        } catch {}
        active.audioEl.play().catch(() => {});
        active.isPlaying = true;
      } else {
        // Track finished
        active.audioEl.pause();
        active.isPlaying = false;
      }
    } else {
      active.audioEl.play().catch(() => {});
      active.isPlaying = true;
    }
  }

  private setPannerPosition(panner: PannerNode, x: number, y: number, z: number, currentTime: number): void {
    if (panner.positionX) {
      panner.positionX.setTargetAtTime(x, currentTime, 0.05);
      panner.positionY.setTargetAtTime(y, currentTime, 0.05);
      panner.positionZ.setTargetAtTime(-z, currentTime, 0.05);
    } else {
      panner.setPosition(x, y, -z);
    }
  }

  public destroyEmitter(id: string): void {
    const active = this.emitters.get(id);
    if (!active) return;

    active.audioEl.pause();
    active.audioEl.src = '';
    try {
      active.sourceNode.disconnect();
      active.gainNode.disconnect();
      active.pannerNode?.disconnect();
    } catch {}

    this.emitters.delete(id);
  }

  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    for (const id of Array.from(this.emitters.keys())) {
      this.destroyEmitter(id);
    }
  }
}
