export interface PeerAudioNode {
  source: MediaStreamAudioSourceNode;
  filter?: BiquadFilterNode;
  panner?: PannerNode;
  gain: GainNode;
  isSubmerged: boolean;
  isChannel?: boolean;
  audioEl?: HTMLAudioElement;
}

export class SpatialAudioPipeline {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private peers = new Map<string, PeerAudioNode>();
  private peerVolumes = new Map<string, number>();
  private peerMuted = new Map<string, boolean>();

  constructor() {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    // Set listener defaults (facing forward along -Z, up along +Y)
    const listener = this.audioContext.listener;
    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(0, this.audioContext.currentTime);
      listener.forwardY.setValueAtTime(0, this.audioContext.currentTime);
      listener.forwardZ.setValueAtTime(-1, this.audioContext.currentTime);
      listener.upX.setValueAtTime(0, this.audioContext.currentTime);
      listener.upY.setValueAtTime(1, this.audioContext.currentTime);
      listener.upZ.setValueAtTime(0, this.audioContext.currentTime);
    } else {
      // Legacy Web Audio API fallback
      listener.setOrientation(0, 0, -1, 0, 1, 0);
    }
  }

  public async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public createLocalAnalyser(stream: MediaStream): AnalyserNode {
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    return analyser;
  }

  public addPeerStream(
    peerUuid: string,
    track: MediaStreamTrack,
    initialPos: {
      relX?: number;
      relY?: number;
      relZ?: number;
      isSubmerged?: boolean;
      isChannel?: boolean;
    }
  ): void {
    if (this.peers.has(peerUuid)) {
      this.removePeerStream(peerUuid);
    }

    const stream = new MediaStream([track]);

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    // HTMLAudioElement sink is required in Chromium (Brave/Chrome/Edge) to activate WebRTC audio receiving pipeline
    const audioEl = document.createElement('audio');
    audioEl.srcObject = stream;
    audioEl.autoplay = true;
    (audioEl as any).playsInline = true;
    audioEl.play().catch((err) => {
      console.warn('[SpatialAudioPipeline] Auto-play was prevented on audio element:', err);
    });

    track.onunmute = () => {
      console.log('[SpatialAudioPipeline] Track unmuted (audio packets flowing) for:', peerUuid);
    };

    console.log('[SpatialAudioPipeline] Added peer stream for:', peerUuid, {
      trackId: track.id,
      trackKind: track.kind,
      trackEnabled: track.enabled,
      trackMuted: track.muted,
      trackReadyState: track.readyState,
      audioContextState: this.audioContext.state,
      isChannel: Boolean(initialPos.isChannel),
    });

    const source = this.audioContext.createMediaStreamSource(stream);
    const gain = this.audioContext.createGain();
    const userVol = this.peerVolumes.get(peerUuid) ?? 1.0;
    const isMuted = this.peerMuted.get(peerUuid) ?? false;
    gain.gain.setValueAtTime(isMuted ? 0 : userVol, this.audioContext.currentTime);

    if (initialPos.isChannel) {
      // Direct Stereo Routing for Fixed Channels (no spatial filtering or panner)
      source.connect(gain);
      gain.connect(this.masterGain);

      this.peers.set(peerUuid, {
        source,
        gain,
        isSubmerged: false,
        isChannel: true,
        audioEl,
      });
      return;
    }

    // Low-pass filter for underwater acoustic damping
    const isSubmerged = Boolean(initialPos.isSubmerged);
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      isSubmerged ? 600 : 20000,
      this.audioContext.currentTime
    );

    // HRTF 3D Panner
    const panner = this.audioContext.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.0;
    panner.maxDistance = 30.0;
    panner.rolloffFactor = 1.0;
    panner.coneInnerAngle = 360;

    this.setPannerPosition(
      panner,
      initialPos.relX ?? 0,
      initialPos.relY ?? 0,
      initialPos.relZ ?? 0
    );

    // Routing: Source -> Filter -> Panner -> Gain -> Master
    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.masterGain);

    this.peers.set(peerUuid, {
      source,
      filter,
      panner,
      gain,
      isSubmerged,
      isChannel: false,
      audioEl,
    });
  }

  public updatePeerPosition(
    peerUuid: string,
    relX: number,
    relY: number,
    relZ: number,
    isSubmerged: boolean
  ): void {
    const peerNode = this.peers.get(peerUuid);
    if (!peerNode || peerNode.isChannel || !peerNode.panner || !peerNode.filter) return;

    // Smooth linear ramp over 100ms interval
    const now = this.audioContext.currentTime;
    const rampTime = now + 0.1;

    if (peerNode.panner.positionX) {
      peerNode.panner.positionX.linearRampToValueAtTime(relX, rampTime);
      peerNode.panner.positionY.linearRampToValueAtTime(relY, rampTime);
      peerNode.panner.positionZ.linearRampToValueAtTime(-relZ, rampTime); // Invert Z for Web Audio camera coords
    } else {
      peerNode.panner.setPosition(relX, relY, -relZ);
    }

    if (peerNode.isSubmerged !== isSubmerged) {
      peerNode.isSubmerged = isSubmerged;
      peerNode.filter.frequency.setTargetAtTime(isSubmerged ? 600 : 20000, now, 0.05);
    }
  }

  public removePeerStream(peerUuid: string): void {
    const peerNode = this.peers.get(peerUuid);
    if (peerNode) {
      if (peerNode.audioEl) {
        peerNode.audioEl.pause();
        peerNode.audioEl.srcObject = null;
        peerNode.audioEl.remove();
      }
      peerNode.gain.disconnect();
      peerNode.panner?.disconnect();
      peerNode.filter?.disconnect();
      peerNode.source.disconnect();
      this.peers.delete(peerUuid);
    }
  }

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1.5, volume));
    this.masterGain.gain.setValueAtTime(clamped, this.audioContext.currentTime);
  }

  public async setOutputDevice(sinkId: string): Promise<boolean> {
    try {
      if ('setSinkId' in this.audioContext && typeof (this.audioContext as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId === 'function') {
        await (this.audioContext as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
        return true;
      }
    } catch (err) {
      console.warn('[SpatialAudioPipeline] setSinkId failed or unsupported:', err);
    }
    return false;
  }

  public setPeerVolume(peerUuid: string, volume: number): void {
    const clamped = Math.max(0, Math.min(2.0, volume));
    this.peerVolumes.set(peerUuid, clamped);
    this.applyPeerGain(peerUuid);
  }

  public setPeerMuted(peerUuid: string, muted: boolean): void {
    this.peerMuted.set(peerUuid, muted);
    this.applyPeerGain(peerUuid);
  }

  public getPeerVolume(peerUuid: string): number {
    return this.peerVolumes.get(peerUuid) ?? 1.0;
  }

  public isPeerMuted(peerUuid: string): boolean {
    return this.peerMuted.get(peerUuid) ?? false;
  }

  public loadPreferences(volumes: Record<string, number>, mutes: Record<string, boolean>): void {
    for (const [k, v] of Object.entries(volumes)) {
      this.peerVolumes.set(k, Math.max(0, Math.min(2.0, v)));
    }
    for (const [k, v] of Object.entries(mutes)) {
      this.peerMuted.set(k, Boolean(v));
    }
    for (const uuid of this.peers.keys()) {
      this.applyPeerGain(uuid);
    }
  }

  private applyPeerGain(peerUuid: string): void {
    const peerNode = this.peers.get(peerUuid);
    if (!peerNode) return;
    const isMuted = this.peerMuted.get(peerUuid) ?? false;
    const userVol = this.peerVolumes.get(peerUuid) ?? 1.0;
    const finalGain = isMuted ? 0 : userVol;
    peerNode.gain.gain.setValueAtTime(finalGain, this.audioContext.currentTime);
  }

  public getContext(): AudioContext {
    return this.audioContext;
  }

  public close(): void {
    for (const uuid of this.peers.keys()) {
      this.removePeerStream(uuid);
    }
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }

  private setPannerPosition(panner: PannerNode, x: number, y: number, z: number): void {
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, this.audioContext.currentTime);
      panner.positionY.setValueAtTime(y, this.audioContext.currentTime);
      panner.positionZ.setValueAtTime(-z, this.audioContext.currentTime);
    } else {
      panner.setPosition(x, y, -z);
    }
  }
}
