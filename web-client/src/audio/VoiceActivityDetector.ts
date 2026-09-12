export interface VADCallbacks {
  onSpeakingChange: (isSpeaking: boolean) => void;
  onVolumeChange: (volumeLevel: number) => void;
}

export class VoiceActivityDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode;
  private threshold: number; // 0.0 to 1.0
  private hangoverMs: number;
  private callbacks: VADCallbacks;

  private isSpeaking = false;
  private hangoverTimer: ReturnType<typeof setTimeout> | null = null;
  private animationFrameId: number | null = null;
  private isRunning = false;

  constructor(
    stream: MediaStream,
    callbacks: VADCallbacks,
    threshold = 0.04,
    hangoverMs = 250
  ) {
    this.callbacks = callbacks;
    this.threshold = threshold;
    this.hangoverMs = hangoverMs;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.2;

    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);

    this.start();
  }

  public setThreshold(threshold: number): void {
    this.threshold = Math.max(0.005, Math.min(0.5, threshold));
  }

  public getThreshold(): number {
    return this.threshold;
  }

  public reset(): void {
    if (this.hangoverTimer) {
      clearTimeout(this.hangoverTimer);
      this.hangoverTimer = null;
    }
    this.isSpeaking = false;
  }

  private start(): void {
    this.isRunning = true;
    const buffer = new Float32Array(this.analyser.fftSize);

    const checkAudio = () => {
      if (!this.isRunning) return;

      this.analyser.getFloatTimeDomainData(buffer);

      // Compute RMS (Root Mean Square) volume level
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const normalizedVolume = Math.min(1.0, rms * 4.0); // scale for visualization

      this.callbacks.onVolumeChange(normalizedVolume);

      if (rms >= this.threshold) {
        if (this.hangoverTimer) {
          clearTimeout(this.hangoverTimer);
          this.hangoverTimer = null;
        }

        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.callbacks.onSpeakingChange(true);
        }
      } else if (this.isSpeaking && !this.hangoverTimer) {
        this.hangoverTimer = setTimeout(() => {
          this.isSpeaking = false;
          this.hangoverTimer = null;
          this.callbacks.onSpeakingChange(false);
        }, this.hangoverMs);
      }

      this.animationFrameId = requestAnimationFrame(checkAudio);
    };

    this.animationFrameId = requestAnimationFrame(checkAudio);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.hangoverTimer) {
      clearTimeout(this.hangoverTimer);
      this.hangoverTimer = null;
    }
    try {
      this.source.disconnect();
    } catch {}
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
  }
}
