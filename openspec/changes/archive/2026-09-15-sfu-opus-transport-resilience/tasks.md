## 1. Backend SFU Opus Codec & Transport Configuration

- [x] 1.1 Update `voice-server/src/config.ts` to configure Opus parameters (`useinbandfec: 1`, `usedtx: 1`, `maxaveragebitrate`, `stereo: 1`, `sprop-stereo: 1`, `ptime: 20`, `minptime: 10`, `maxptime: 60`) with `OPUS_MAX_AVERAGE_BITRATE` env support and verify config exports.
- [x] 1.2 Tune `initialAvailableOutgoingBitrate` in `voice-server/src/config.ts` to 128 kbps to accommodate multi-stream spatial audio without startup throttling.
- [x] 1.3 Verify worker router creation in `voice-server/src/sfu/MediasoupManager.ts` propagates the Opus parameters to router RTP capabilities.

## 2. Web Client Producer Codec Negotiation

- [x] 2.1 Update `web-client/src/net/VoiceSignaling.ts` to supply explicit `codecOptions` (`opusFec: true`, `opusDtx: true`, `opusMaxaveragebitrate`) in `sendTransport.produce()`.
- [x] 2.2 Verify that `replaceMicrophoneTrack` and dynamic device switching function without renegotiation or transport drop.

## 3. Verification & Validation

- [x] 3.1 Run `npm run build` in both `voice-server` and `web-client` to verify zero TypeScript or bundler errors.
- [x] 3.2 Run `openspec validate sfu-opus-transport-resilience --strict` to verify all OpenSpec requirements, deltas, and dependencies pass.
