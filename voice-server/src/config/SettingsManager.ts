import fs from 'fs';
import path from 'path';
import { ServerSettings } from '../types.js';

export const DEFAULT_SETTINGS: ServerSettings = {
  branding: {
    serverName: 'VoiceEngine Server',
    tagline: 'Zero-Mod Proximity Voice Chat',
    logoUrl: '',
    backgroundUrl: '',
    primaryColor: '#6366f1',
    accentColor: '#22c55e',
    welcomeMessage: 'Welcome to VoiceEngine! Proximity voice is active.',
  },
  voice: {
    maxSlots: 100,
    maxVoiceDistance: 30.0,
    sneakVoiceDistance: 8.0,
    defaultBitrate: 64000,
  },
  fixedChannels: [
    {
      id: 'lobby',
      name: 'General Lobby',
      description: 'Global voice room without 3D distance',
      userLimit: 0,
      isDefault: true,
    },
    {
      id: 'staff',
      name: 'Staff Room',
      description: 'Private room for server staff',
      userLimit: 10,
      isDefault: false,
    },
  ],
};

export class SettingsManager {
  private filePath: string;
  private currentSettings: ServerSettings;
  private listeners: Array<(settings: ServerSettings) => void> = [];

  constructor(filePath?: string) {
    this.filePath = filePath || path.resolve(process.cwd(), 'data/settings.json');
    this.currentSettings = this.loadOrInit();
  }

  private loadOrInit(): ServerSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return this.validateAndNormalize(parsed);
      }
    } catch (err) {
      console.warn(`[SettingsManager] Could not read ${this.filePath}, falling back to defaults:`, err);
    }

    // Initialize with defaults and save
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveDirect(settings);
    return settings;
  }

  public getSettings(): ServerSettings {
    return JSON.parse(JSON.stringify(this.currentSettings));
  }

  public getPublicConfig() {
    return {
      branding: this.currentSettings.branding,
      voice: this.currentSettings.voice,
      maxSlots: this.currentSettings.voice.maxSlots,
      fixedChannels: this.currentSettings.fixedChannels,
    };
  }

  public async updateSettings(updates: Partial<ServerSettings>): Promise<ServerSettings> {
    const merged: ServerSettings = {
      branding: {
        ...this.currentSettings.branding,
        ...(updates.branding || {}),
      },
      voice: {
        ...this.currentSettings.voice,
        ...(updates.voice || {}),
      },
      fixedChannels: updates.fixedChannels ? [...updates.fixedChannels] : this.currentSettings.fixedChannels,
    };

    const validated = this.validateAndNormalize(merged);
    await this.saveAtomic(validated);
    this.currentSettings = validated;

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(this.currentSettings);
      } catch (e) {
        console.error('[SettingsManager] Listener error:', e);
      }
    }

    return this.getSettings();
  }

  public onSettingsUpdated(listener: (settings: ServerSettings) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public validateAndNormalize(input: unknown): ServerSettings {
    if (!input || typeof input !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    const raw = input as Partial<ServerSettings>;
    const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    // Validate branding
    const branding = raw.branding || defaultCopy.branding;
    const cleanBranding = {
      serverName: typeof branding.serverName === 'string' && branding.serverName.trim() ? branding.serverName.trim() : defaultCopy.branding.serverName,
      tagline: typeof branding.tagline === 'string' ? branding.tagline.trim() : defaultCopy.branding.tagline,
      logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl.trim() : '',
      backgroundUrl: typeof branding.backgroundUrl === 'string' ? branding.backgroundUrl.trim() : '',
      primaryColor: this.sanitizeHexColor(branding.primaryColor, defaultCopy.branding.primaryColor),
      accentColor: this.sanitizeHexColor(branding.accentColor, defaultCopy.branding.accentColor),
      welcomeMessage: typeof branding.welcomeMessage === 'string' ? branding.welcomeMessage : defaultCopy.branding.welcomeMessage,
    };

    // Validate voice
    const voice = raw.voice || defaultCopy.voice;
    const maxVoiceDist = typeof voice.maxVoiceDistance === 'number' && voice.maxVoiceDistance > 0 ? voice.maxVoiceDistance : defaultCopy.voice.maxVoiceDistance;
    const sneakVoiceDist = typeof voice.sneakVoiceDistance === 'number' && voice.sneakVoiceDistance > 0 && voice.sneakVoiceDistance <= maxVoiceDist ? voice.sneakVoiceDistance : defaultCopy.voice.sneakVoiceDistance;
    const maxSlots = typeof voice.maxSlots === 'number' && voice.maxSlots >= 1 ? Math.floor(voice.maxSlots) : defaultCopy.voice.maxSlots;
    const defaultBitrate = typeof voice.defaultBitrate === 'number' && voice.defaultBitrate >= 16000 && voice.defaultBitrate <= 128000 ? voice.defaultBitrate : defaultCopy.voice.defaultBitrate;

    const cleanVoice = {
      maxSlots,
      maxVoiceDistance: maxVoiceDist,
      sneakVoiceDistance: sneakVoiceDist,
      defaultBitrate,
    };

    // Validate fixedChannels
    let cleanChannels = defaultCopy.fixedChannels;
    if (Array.isArray(raw.fixedChannels)) {
      cleanChannels = raw.fixedChannels
        .filter((c) => c && typeof c === 'object' && typeof c.id === 'string' && c.id.trim() && typeof c.name === 'string' && c.name.trim())
        .map((c) => ({
          id: c.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''),
          name: c.name.trim(),
          description: typeof c.description === 'string' ? c.description.trim() : '',
          userLimit: typeof c.userLimit === 'number' && c.userLimit >= 0 ? Math.floor(c.userLimit) : 0,
          isDefault: Boolean(c.isDefault),
        }));
    }

    return {
      branding: cleanBranding,
      voice: cleanVoice,
      fixedChannels: cleanChannels,
    };
  }

  private sanitizeHexColor(color: unknown, fallback: string): string {
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color.trim())) {
      return color.trim();
    }
    return fallback;
  }

  private saveDirect(settings: ServerSettings): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[SettingsManager] Failed to save settings to ${this.filePath}:`, err);
    }
  }

  private async saveAtomic(settings: ServerSettings): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const tmpFile = `${this.filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
    await fs.promises.writeFile(tmpFile, JSON.stringify(settings, null, 2), 'utf-8');
    await fs.promises.rename(tmpFile, this.filePath);
  }
}
