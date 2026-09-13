export type EmitterState = 'PLAYING' | 'PAUSED' | 'STOPPED';

export interface AudioEmitter {
  id: string;
  source: string;
  mediaUrl: string;
  spatial: boolean;
  world?: string;
  position?: { x: number; y: number; z: number };
  radius: number;
  state: EmitterState;
  startedAt: number;
  pausedAt?: number;
  duration?: number;
  loop: boolean;
  volume: number;
  speakerBlockId?: string;
}

export interface CreateEmitterOptions {
  id: string;
  source: string;
  mediaUrl?: string;
  spatial?: boolean;
  world?: string;
  position?: { x: number; y: number; z: number };
  radius?: number;
  duration?: number;
  loop?: boolean;
  volume?: number;
  speakerBlockId?: string;
}

export type EmitterEventListener = (event: string, emitter: AudioEmitter) => void;

export class AudioEmitterManager {
  private emitters = new Map<string, AudioEmitter>();
  private listeners: EmitterEventListener[] = [];

  public onEvent(listener: EmitterEventListener): void {
    this.listeners.push(listener);
  }

  private emit(event: string, emitter: AudioEmitter): void {
    for (const listener of this.listeners) {
      try {
        listener(event, emitter);
      } catch (err) {
        console.error('[AudioEmitterManager] Listener error:', err);
      }
    }
  }

  public resolveMediaUrl(source: string): string {
    const trimmed = source.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // External streams can be streamed via CORS proxy
      return `/api/media/proxy?url=${encodeURIComponent(trimmed)}`;
    }
    // Local file inside media directory
    return `/api/media/${encodeURIComponent(trimmed)}`;
  }

  public createEmitter(options: CreateEmitterOptions): AudioEmitter {
    const id = options.id.trim();
    const mediaUrl = options.mediaUrl || this.resolveMediaUrl(options.source);
    const spatial = options.spatial ?? Boolean(options.position);
    const radius = options.radius !== undefined ? Math.max(1, options.radius) : 30.0;
    const volume = options.volume !== undefined ? Math.max(0, Math.min(1, options.volume)) : 1.0;
    const loop = options.loop ?? false;

    const emitter: AudioEmitter = {
      id,
      source: options.source,
      mediaUrl,
      spatial,
      world: options.world || 'world',
      position: options.position,
      radius,
      state: 'PLAYING',
      startedAt: Date.now(),
      duration: options.duration,
      loop,
      volume,
      speakerBlockId: options.speakerBlockId,
    };

    this.emitters.set(id, emitter);
    this.emit('start', emitter);
    return emitter;
  }

  public pauseEmitter(id: string): AudioEmitter | null {
    const emitter = this.emitters.get(id);
    if (!emitter || emitter.state !== 'PLAYING') return null;

    emitter.state = 'PAUSED';
    emitter.pausedAt = Date.now();
    this.emit('pause', emitter);
    return emitter;
  }

  public resumeEmitter(id: string): AudioEmitter | null {
    const emitter = this.emitters.get(id);
    if (!emitter || emitter.state !== 'PAUSED') return null;

    const pausedDelta = Date.now() - (emitter.pausedAt || Date.now());
    emitter.startedAt += pausedDelta;
    emitter.state = 'PLAYING';
    emitter.pausedAt = undefined;
    this.emit('resume', emitter);
    return emitter;
  }

  public stopEmitter(id: string): boolean {
    const emitter = this.emitters.get(id);
    if (!emitter) return false;

    emitter.state = 'STOPPED';
    this.emitters.delete(id);
    this.emit('stop', emitter);
    return true;
  }

  public stopAll(): number {
    const count = this.emitters.size;
    const all = Array.from(this.emitters.values());
    this.emitters.clear();
    for (const emitter of all) {
      emitter.state = 'STOPPED';
      this.emit('stop', emitter);
    }
    return count;
  }

  public setVolume(id: string, volume: number): AudioEmitter | null {
    const emitter = this.emitters.get(id);
    if (!emitter) return null;

    emitter.volume = Math.max(0, Math.min(1, volume));
    this.emit('volume', emitter);
    return emitter;
  }

  public getEmitter(id: string): AudioEmitter | undefined {
    return this.emitters.get(id);
  }

  public getAllEmitters(): AudioEmitter[] {
    return Array.from(this.emitters.values());
  }

  public getActiveEmitters(): AudioEmitter[] {
    return Array.from(this.emitters.values()).filter((e) => e.state === 'PLAYING' || e.state === 'PAUSED');
  }
}
