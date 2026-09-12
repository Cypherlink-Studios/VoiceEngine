import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SettingsManager, DEFAULT_SETTINGS } from '../src/config/SettingsManager.js';

describe('SettingsManager', () => {
  let tempDir: string;
  let settingsFile: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 've-settings-'));
    settingsFile = path.join(tempDir, 'settings.json');
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('initializes with default settings when file does not exist', () => {
    const manager = new SettingsManager(settingsFile);
    const settings = manager.getSettings();

    expect(settings.branding.serverName).toBe(DEFAULT_SETTINGS.branding.serverName);
    expect(settings.voice.maxSlots).toBe(100);
    expect(settings.fixedChannels.length).toBeGreaterThan(0);
    expect(fs.existsSync(settingsFile)).toBe(true);
  });

  it('validates and sanitizes invalid values', async () => {
    const manager = new SettingsManager(settingsFile);

    const updated = await manager.updateSettings({
      branding: {
        serverName: 'Custom Server',
        tagline: 'Custom Tagline',
        logoUrl: 'https://example.com/logo.png',
        backgroundUrl: '',
        primaryColor: 'invalid-color', // Should be normalized to default
        accentColor: '#10b981',
        welcomeMessage: 'Hello!',
      },
      voice: {
        maxSlots: -5, // Invalid, should default
        maxVoiceDistance: 50.0,
        sneakVoiceDistance: 12.0,
        defaultBitrate: 96000,
      },
      fixedChannels: [
        {
          id: 'TEST CHANNEL!', // Should be normalized to slug
          name: 'Test Room',
          description: 'A test room',
          userLimit: 5,
        },
      ],
    });

    expect(updated.branding.serverName).toBe('Custom Server');
    expect(updated.branding.primaryColor).toBe(DEFAULT_SETTINGS.branding.primaryColor);
    expect(updated.branding.accentColor).toBe('#10b981');
    expect(updated.voice.maxSlots).toBe(DEFAULT_SETTINGS.voice.maxSlots);
    expect(updated.voice.maxVoiceDistance).toBe(50.0);
    expect(updated.voice.sneakVoiceDistance).toBe(12.0);
    expect(updated.fixedChannels[0].id).toBe('testchannel');
  });

  it('fires listener when settings are updated', async () => {
    const manager = new SettingsManager(settingsFile);
    let notified = false;

    const unsubscribe = manager.onSettingsUpdated((newSettings) => {
      if (newSettings.branding.serverName === 'Notified Server') {
        notified = true;
      }
    });

    await manager.updateSettings({
      branding: {
        ...manager.getSettings().branding,
        serverName: 'Notified Server',
      },
    });

    expect(notified).toBe(true);
    unsubscribe();
  });
});
