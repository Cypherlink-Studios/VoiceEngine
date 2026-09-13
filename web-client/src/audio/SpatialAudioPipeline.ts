export interface PeerAudioNode {
  source: MediaStreamAudioSourceNode;
  track: MediaStreamTrack;
  filter?: BiquadFilterNode;
  panner?: PannerNode;
  gain: GainNode;
  isSubmerged: boolean;
  isChannel?: boolean;
  isPaused?: boolean;
}

export class SpatialAudioPipeline {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private proximityBusGain: GainNode;
  private deafenGain: GainNode;
  private peers = new Map<string, PeerAudioNode>();
  private peerVolumes = new Map<string, number>();
  private peerMuted = new Map<string, boolean>();
  private isDeafenedState = false;
  private isDuckingState = false;

  // Single persistent hidden sink to keep Chromium WebRTC audio decoder active
  // without creating/destroying WASAPI audio sessions per peer in Windows
  private persistentSinkEl: HTMLAudioElement | null = null;
  private persistentSinkStream: MediaStream | null = null;

  private loopbackSource: MediaStreamAudioSourceNode | null = null;
  private loopbackDelay: DelayNode | null = null;
  private loopbackGain: GainNode | null = null;
  private isLoopbackActive = false;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.masterGain = this.audioContext.createGain();
    this.proximityBusGain = this.audioContext.createGain();
    this.deafenGain = this.audioContext.createGain();

    // Route: proximityBusGain -> masterGain; fixed channels directly -> masterGain
    // Master routing: masterGain -> deafenGain -> destination
    this.proximityBusGain.connect(this.masterGain);
    this.masterGain.connect(this.deafenGain);
    this.deafenGain.connect(this.audioContext.destination);

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

    if (typeof document !== 'undefined') {
      this.persistentSinkStream = new MediaStream();
      this.persistentSinkEl = document.createElement('audio');
      this.persistentSinkEl.muted = false; // Must NOT be muted so Chromium keeps WebRTC audio decoding active
      this.persistentSinkEl.volume = 0.0001; // Inaudible (-80dB) dummy sink to prevent direct leakage
      this.persistentSinkEl.autoplay = true;
      (this.persistentSinkEl as any).playsInline = true;
      this.persistentSinkEl.srcObject = this.persistentSinkStream;
      this.persistentSinkEl.play().catch(() => {});
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
    const existing = this.peers.get(peerUuid);
    if (existing) {
      // If the track is identical, reuse existing node graph, refresh source and simply unpause
      if (existing.track === track) {
        existing.isPaused = false;
        this.refreshPeerSource(peerUuid);
        this.applyPeerGain(peerUuid);
        if (initialPos.relX !== undefined && initialPos.relY !== undefined && initialPos.relZ !== undefined) {
          this.updatePeerPosition(
            peerUuid,
            initialPos.relX,
            initialPos.relY,
            initialPos.relZ,
            Boolean(initialPos.isSubmerged),
            false
          );
        }
        return;
      }
      this.removePeerStream(peerUuid);
    }

    const stream = new MediaStream([track]);

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    // Keep Chromium WebRTC audio decoding active via single persistent sink
    if (this.persistentSinkStream && !this.persistentSinkStream.getTracks().includes(track)) {
      try {
        this.persistentSinkStream.addTrack(track);
        if (this.persistentSinkEl) {
          // Re-bind srcObject to ensure Chromium registers dynamic track addition
          this.persistentSinkEl.srcObject = this.persistentSinkStream;
          this.persistentSinkEl.play().catch(() => {});
        }
      } catch {}
    }

    track.onunmute = () => {
      console.log('[SpatialAudioPipeline] Track unmuted (audio packets flowing) for:', peerUuid);
      this.refreshPeerSource(peerUuid);
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
        track,
        gain,
        isSubmerged: false,
        isChannel: true,
        isPaused: false,
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

    // Routing: Source -> Filter -> Panner -> Gain -> Proximity Bus
    source.connect(filter);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.proximityBusGain);

    this.peers.set(peerUuid, {
      source,
      track,
      filter,
      panner,
      gain,
      isSubmerged,
      isChannel: false,
      isPaused: false,
    });
  }

  public refreshPeerSource(peerUuid: string): void {
    const peerNode = this.peers.get(peerUuid);
    if (!peerNode || !peerNode.track) return;
    try {
      peerNode.source.disconnect();
      const newSource = this.audioContext.createMediaStreamSource(new MediaStream([peerNode.track]));
      if (peerNode.isChannel || !peerNode.filter) {
        newSource.connect(peerNode.gain);
      } else {
        newSource.connect(peerNode.filter);
      }
      peerNode.source = newSource;
      console.log('[SpatialAudioPipeline] Refreshed MediaStreamAudioSourceNode for:', peerUuid);
    } catch (err) {
      console.warn('[SpatialAudioPipeline] Failed to refresh source node for:', peerUuid, err);
    }
  }

  public updatePeerPosition(
    peerUuid: string,
    relX: number,
    relY: number,
    relZ: number,
    isSubmerged: boolean,
    isPaused?: boolean
  ): void {
    const peerNode = this.peers.get(peerUuid);
    if (!peerNode || peerNode.isChannel || !peerNode.panner || !peerNode.filter) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (isPaused !== undefined && peerNode.isPaused !== isPaused) {
      peerNode.isPaused = isPaused;
      if (!isPaused) {
        // Resuming from distance pause: refresh source node to bypass Chromium mute-stall
        this.refreshPeerSource(peerUuid);
      }
      this.applyPeerGain(peerUuid);
    }

    if (peerNode.isPaused) {
      return;
    }

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
      if (this.persistentSinkStream && peerNode.track) {
        try {
          this.persistentSinkStream.removeTrack(peerNode.track);
        } catch {}
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
    const isPaused = Boolean(peerNode.isPaused);
    const targetGain = (isMuted || isPaused) ? 0 : userVol;
    peerNode.gain.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.03);
  }

  public setDeafened(deafened: boolean): void {
    this.isDeafenedState = deafened;
    this.deafenGain.gain.setTargetAtTime(
      deafened ? 0 : 1.0,
      this.audioContext.currentTime,
      0.03
    );
  }

  public isDeafened(): boolean {
    return this.isDeafenedState;
  }

  public setRadioDucking(ducking: boolean): void {
    this.isDuckingState = ducking;
    this.proximityBusGain.gain.setTargetAtTime(
      ducking ? 0.35 : 1.0,
      this.audioContext.currentTime,
      0.06
    );
  }

  public isRadioDucking(): boolean {
    return this.isDuckingState;
  }

  public startLoopback(stream: MediaStream, delaySeconds: number = 0.18, isCurrentlyTransmitting: boolean = false): void {
    this.stopLoopback();
    try {
      this.loopbackSource = this.audioContext.createMediaStreamSource(stream);
      this.loopbackDelay = this.audioContext.createDelay(1.0);
      this.loopbackDelay.delayTime.setValueAtTime(delaySeconds, this.audioContext.currentTime);
      this.loopbackGain = this.audioContext.createGain();
      const initialGain = isCurrentlyTransmitting ? 0.8 : 0.0;
      this.loopbackGain.gain.setValueAtTime(initialGain, this.audioContext.currentTime);

      this.loopbackSource.connect(this.loopbackDelay);
      this.loopbackDelay.connect(this.loopbackGain);
      this.loopbackGain.connect(this.audioContext.destination);
      this.isLoopbackActive = true;
    } catch (err) {
      console.warn('[SpatialAudioPipeline] Failed to start loopback:', err);
    }
  }

  public setLoopbackGated(isOpen: boolean): void {
    if (this.loopbackGain && this.isLoopbackActive) {
      const targetGain = isOpen ? 0.8 : 0.0;
      this.loopbackGain.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.015);
    }
  }

  public stopLoopback(): void {
    if (!this.isLoopbackActive) return;
    try {
      this.loopbackSource?.disconnect();
      this.loopbackDelay?.disconnect();
      this.loopbackGain?.disconnect();
    } catch {}
    this.loopbackSource = null;
    this.loopbackDelay = null;
    this.loopbackGain = null;
    this.isLoopbackActive = false;
  }

  public isLoopbackRunning(): boolean {
    return this.isLoopbackActive;
  }

  public getContext(): AudioContext {
    return this.audioContext;
  }

  public close(): void {
    this.stopLoopback();
    for (const uuid of this.peers.keys()) {
      this.removePeerStream(uuid);
    }
    if (this.persistentSinkEl) {
      this.persistentSinkEl.pause();
      this.persistentSinkEl.srcObject = null;
      this.persistentSinkEl = null;
    }
    if (this.persistentSinkStream) {
      this.persistentSinkStream.getTracks().forEach((t) => t.stop());
      this.persistentSinkStream = null;
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
