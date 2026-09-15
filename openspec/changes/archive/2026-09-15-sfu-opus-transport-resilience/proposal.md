## Why

In real-world Minecraft proximity voice chat deployments, players experience unpredictable WiFi and mobile broadband network conditions with intermittent packet loss and bandwidth constraints. By optimizing the mediasoup SFU router configuration and WebRTC audio producer parameters for Opus In-Band Forward Error Correction (FEC) and Discontinuous Transmission (DTX), VoiceEngine can recover lost audio packets transparently and reduce idle network traffic by up to 40-50% without quality degradation.

## What Changes

- **Opus In-Band FEC Configuration**: Configure mediasoup `mediaCodecs` parameters with `useinbandfec: 1` and negotiate FEC on web-client audio producers, enabling the Opus decoder to reconstruct lost voice packets from redundant sideband data without retransmissions.
- **Opus Discontinuous Transmission (DTX)**: Configure mediasoup `mediaCodecs` parameters with `usedtx: 1` and client `opusDtx: true`, reducing transmission bandwidth to minimal comfort noise packets during silence intervals.
- **Configurable Audio Bitrate & Transport Tuning**: Add environment/config controls for `OPUS_MAX_AVERAGE_BITRATE` (default: 64 kbps, configurable from 24 kbps to 128 kbps), `OPUS_PTIME` (20ms standard packet frame), and tune mediasoup `initialAvailableOutgoingBitrate` for immediate clear audio delivery.
- **WebRTC Client Producer Codec Negotiation**: Update `web-client`'s `VoiceSignaling.ts` to pass explicit `codecOptions` (`opusFec: true`, `opusDtx: true`, `opusMaxaveragebitrate`) during `sendTransport.produce()` and device capability negotiation.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `voice-backend-sfu`: Update `WebRTC SFU Media Routing` requirement to mandate Opus In-Band Forward Error Correction (FEC), Discontinuous Transmission (DTX), and configurable bitrate/packet framing parameters across all worker routers and transport producers.

## Impact

- `voice-server/src/config.ts`: Define explicit Opus codec parameters (`useinbandfec`, `usedtx`, `maxaveragebitrate`, `stereo`, `sprop-stereo`, `ptime`) and transport bitrate defaults.
- `voice-server/src/sfu/MediasoupManager.ts`: Ensure all worker routers inherit optimized Opus RTP codec capabilities.
- `voice-server/src/gateway/ClientGateway.ts`: Verify consumer and producer RTP negotiation and telemetry reporting.
- `web-client/src/net/VoiceSignaling.ts`: Pass `codecOptions` on `sendTransport.produce()`.
