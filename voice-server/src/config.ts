import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  secretKey: process.env.SECRET_KEY || 'change-me-to-a-secure-random-secret',
  
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
