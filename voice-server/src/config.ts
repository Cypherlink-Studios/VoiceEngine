import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const resolveDefaultMediaDir = () => {
  if (process.env.MEDIA_DIR) {
    return path.resolve(process.env.MEDIA_DIR);
  }
  const parentPath = path.resolve(process.cwd(), '../plugins/VoiceEngine/media');
  if (fs.existsSync(parentPath) || path.basename(process.cwd()) === 'voice-server') {
    return parentPath;
  }
  return path.resolve(process.cwd(), 'plugins/VoiceEngine/media');
};

const defaultMediaDir = resolveDefaultMediaDir();
const defaultMediaCacheDir = process.env.MEDIA_CACHE_DIR
  ? path.resolve(process.env.MEDIA_CACHE_DIR)
  : path.resolve(defaultMediaDir, 'cache');

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  secretKey: process.env.SECRET_KEY || 'change-me-to-a-secure-random-secret',
  isProduction: process.env.NODE_ENV === 'production',
  enableDevTokens: process.env.ENABLE_DEV_TOKENS !== undefined
    ? process.env.ENABLE_DEV_TOKENS === 'true'
    : process.env.NODE_ENV !== 'production',

  // Media settings
  mediaDir: defaultMediaDir,
  mediaCacheDir: defaultMediaCacheDir,
  mediaMaxCacheSizeMb: parseInt(process.env.MEDIA_MAX_CACHE_SIZE_MB || '1024', 10),
  mediaMaxCacheAgeDays: parseInt(process.env.MEDIA_MAX_CACHE_AGE_DAYS || '7', 10),
  
  // Proximity settings (in blocks)
  maxVoiceDistance: parseFloat(process.env.MAX_VOICE_DISTANCE || '30.0'),
  sneakVoiceDistance: parseFloat(process.env.SNEAK_VOICE_DISTANCE || '8.0'),
  
  // Mediasoup SFU settings
  mediasoup: {
    numWorkers: 1,
    workerSettings: {
      logLevel: 'warn' as const,
      rtcMinPort: parseInt(process.env.RTC_MIN_PORT || '40000', 10),
      rtcMaxPort: parseInt(process.env.RTC_MAX_PORT || '40100', 10),
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio' as const,
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
      ],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: process.env.LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      initialAvailableOutgoingBitrate: 64000,
    },
  },
};

export function ensureMediaDirs(): void {
  if (!fs.existsSync(config.mediaDir)) {
    fs.mkdirSync(config.mediaDir, { recursive: true });
  }
  if (!fs.existsSync(config.mediaCacheDir)) {
    fs.mkdirSync(config.mediaCacheDir, { recursive: true });
  }
}

