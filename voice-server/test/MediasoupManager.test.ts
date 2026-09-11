import { describe, it, expect, afterAll } from 'vitest';
import { MediasoupManager } from '../src/sfu/MediasoupManager.js';

describe('MediasoupManager', () => {
  const sfu = new MediasoupManager();

  afterAll(() => {
    sfu.close();
  });

  it('initializes worker and creates router with Opus codec capabilities', async () => {
    await sfu.init();
    const router = sfu.getRouter();
    expect(router).toBeDefined();

    const capabilities = sfu.getRtpCapabilities();
    expect(capabilities).toBeDefined();
    expect(capabilities.codecs).toBeDefined();

    const opusCodec = capabilities.codecs?.find(
      (c) => c.mimeType.toLowerCase() === 'audio/opus'
    );
    expect(opusCodec).toBeDefined();
    expect(opusCodec?.clockRate).toBe(48000);
    expect(opusCodec?.channels).toBe(2);
  }, 15000);

  it('creates WebRTC transport with valid transport parameters', async () => {
    const transport = await sfu.createWebRtcTransport();
    expect(transport.id).toBeDefined();
    expect(transport.iceParameters).toBeDefined();
    expect(transport.iceCandidates).toBeDefined();
    expect(transport.dtlsParameters).toBeDefined();
    transport.close();
  });
});
