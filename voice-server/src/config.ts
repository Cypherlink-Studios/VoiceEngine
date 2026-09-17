import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const resolveMediaDirs = (): string[] => {
  const dirs: string[] = [];
  if (process.env.MEDIA_DIR) {
    dirs.push(path.resolve(process.env.MEDIA_DIR));
  }
  const candidatePaths = [
    path.resolve(process.cwd(), '../plugins/VoiceEngine/media'),
    path.resolve(process.cwd(), 'plugins/VoiceEngine/media'),
  ];
  for (const cand of candidatePaths) {
    if (fs.existsSync(cand)) {
      dirs.push(cand);
    }
  }
  if (dirs.length === 0) {
    dirs.push(path.resolve(process.cwd(), '../plugins/VoiceEngine/media'));
  }
  return Array.from(new Set(dirs));
};

const discoveredMediaDirs = resolveMediaDirs();
const defaultMediaDir = discoveredMediaDirs[0];
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
  mediaDirs: discoveredMediaDirs,
  mediaCacheDir: defaultMediaCacheDir,
  mediaMaxCacheSizeMb: parseInt(process.env.MEDIA_MAX_CACHE_SIZE_MB || '1024', 10),
  mediaMaxCacheAgeDays: parseInt(process.env.MEDIA_MAX_CACHE_AGE_DAYS || '7', 10),
  ytDlpPath: process.env.YT_DLP_PATH || '',
  ffmpegPath: process.env.FFMPEG_PATH || '',
  ytCookiesPath: process.env.YT_COOKIES_PATH || '',
  
  // Proximity settings (in blocks)
  maxVoiceDistance: parseFloat(process.env.MAX_VOICE_DISTANCE || '30.0'),
  sneakVoiceDistance: parseFloat(process.env.SNEAK_VOICE_DISTANCE || '8.0'),
  
  // Mediasoup SFU settings
  mediasoup: {
    numWorkers: Math.max(1, parseInt(process.env.MEDIASOUP_NUM_WORKERS || '1', 10)),
    workerSettings: {
      logLevel: 'warn' as const,
      rtcMinPort: parseInt(process.env.RTC_MIN_PORT || '40000', 10),
      rtcMaxPort: parseInt(process.env.RTC_MAX_PORT || '49999', 10),
    },
    router: {
      opusMaxAverageBitrate: parseInt(process.env.OPUS_MAX_AVERAGE_BITRATE || '64000', 10),
      mediaCodecs: [
        {
          kind: 'audio' as const,
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
          parameters: {
            useinbandfec: 1,
            usedtx: 1,
            maxaveragebitrate: parseInt(process.env.OPUS_MAX_AVERAGE_BITRATE || '64000', 10),
            stereo: 1,
            'sprop-stereo': 1,
            ptime: 20,
            minptime: 10,
            maxptime: 60,
          },
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
      initialAvailableOutgoingBitrate: 128000,
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

