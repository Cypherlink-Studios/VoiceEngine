export class SoundEffects {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5; // 0.0 - 1.0

  constructor(ctx?: AudioContext) {
    if (ctx) {
      this.init(ctx);
    }
  }

  public init(ctx: AudioContext): void {
    if (this.ctx === ctx && this.sfxGain) return;
    this.ctx = ctx;
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.enabled ? this.volume : 0, ctx.currentTime);
    this.sfxGain.connect(ctx.destination);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(enabled ? this.volume : 0, this.ctx.currentTime);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1.0, vol));
    if (this.sfxGain && this.ctx && this.enabled) {
      this.sfxGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public playMute(): void {
    // Descending soft tones
    this.playToneSequence([
      { freq: 440, duration: 0.08, type: 'sine' },
      { freq: 330, duration: 0.12, type: 'sine' },
    ]);
  }

  public playUnmute(): void {
    // Ascending bright tones
    this.playToneSequence([
      { freq: 330, duration: 0.08, type: 'sine' },
      { freq: 550, duration: 0.12, type: 'sine' },
    ]);
  }

  public playConnect(): void {
    // Harmonious major triad chime
    this.playToneSequence([
      { freq: 523.25, duration: 0.07, type: 'sine' },
      { freq: 659.25, duration: 0.07, type: 'sine' },
      { freq: 783.99, duration: 0.16, type: 'sine' },
    ]);
  }

  public playDisconnect(): void {
    // Soft descending tone
    this.playToneSequence([
      { freq: 659.25, duration: 0.09, type: 'sine' },
      { freq: 440, duration: 0.15, type: 'sine' },
    ]);
  }

  public playChannelSwitch(): void {
    // Soft transition blip
    this.playToneSequence([
      { freq: 587.33, duration: 0.06, type: 'sine' },
      { freq: 740.0, duration: 0.1, type: 'sine' },
    ]);
  }

  private playToneSequence(tones: Array<{ freq: number; duration: number; type: OscillatorType }>): void {
    if (!this.enabled || !this.ctx || !this.sfxGain || this.ctx.state === 'closed') return;
    try {
      let startTime = this.ctx.currentTime;
      for (const tone of tones) {
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        osc.type = tone.type;
        osc.frequency.setValueAtTime(tone.freq, startTime);

        // Gentle attack and decay envelope to prevent clicks
        noteGain.gain.setValueAtTime(0.001, startTime);
        noteGain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.01);
        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + tone.duration);

        osc.connect(noteGain);
        noteGain.connect(this.sfxGain);

        osc.start(startTime);
        osc.stop(startTime + tone.duration);

        startTime += tone.duration * 0.85;
      }
    } catch (err) {
      console.warn('[SoundEffects] Error synthesizing effect:', err);
    }
  }
}

export const soundEffects = new SoundEffects();
