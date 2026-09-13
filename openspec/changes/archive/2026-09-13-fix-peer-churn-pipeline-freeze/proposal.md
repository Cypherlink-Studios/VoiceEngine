## Why

When players join, leave, or move across proximity boundaries in VoiceEngine, connected web clients experience noticeable UI and audio freezing (100–500ms stutters). This is caused by an architectural thrashing loop in `ClientGateway.ts` where fixed channel routing was inadvertently nested inside the proximity routing block (causing consumers to be culled and recreated 10 times per second), coupled with repeated WebRTC SDP renegotiations, heavy HRTF PannerNode allocations, and per-peer `<audio>` element creation/teardown in Chromium on Windows.

Resolving this eliminates client freezes, drastically reduces SFU CPU and network overhead, and ensures seamless, glitch-free audio transitions when players enter or exit proximity.

## What Changes

- **Strict Routing Isolation**: Isolate fixed-channel routing into an exclusive `else` branch in `ClientGateway.ts`, preventing proximity players from being matched as fixed-channel members and halting the 10 Hz consumer churn loop.
- **Consumer Pause/Resume Lifecycle**: Transition proximity distance culling from destructive `consumer.close()` to non-destructive `consumer.pause()` and `consumer.resume()` in Mediasoup, keeping WebRTC transceivers intact while dropping RTP network traffic to zero when players are out of range.
- **Single Persistent Audio Sink**: Replace per-peer `<audio>` element DOM instantiation and teardown in `SpatialAudioPipeline.ts` with a single, persistent, muted `<audio>` element acting as the Chromium WebRTC audio decoding activator.
- **Graceful Stream Lifecycle in Client**: Update `VoiceSignaling.ts` and `SpatialAudioPipeline.ts` to handle paused/resumed states smoothly without reconstructing the Web Audio graph.
- **Throttled Peer State Updates**: Buffer or throttle rapid peer updates to protect React UI components (`PlayerRoute.tsx` and `Radar.tsx`) from main-thread frame drops.

## Capabilities

### Modified Capabilities
- `voice-backend-sfu`: Update proximity routing and consumer lifecycle requirements to specify non-destructive consumer pausing/resuming for distance culling and strict separation from fixed channels.
- `web-client-spatial-audio`: Update peer stream management requirements to specify single persistent WebRTC audio sink usage and stutter-free stream lifecycle without Web Audio graph recreation on distance threshold crossings.

## Impact

- **Backend**: `voice-server/src/gateway/ClientGateway.ts`, `voice-server/src/sfu/MediasoupManager.ts`.
- **Frontend**: `web-client/src/net/VoiceSignaling.ts`, `web-client/src/audio/SpatialAudioPipeline.ts`, `web-client/src/routes/PlayerRoute.tsx`.
- **Network / Protocol**: New WebSocket message types for consumer pause/resume (or payload flags on `peer_spatial_update`) avoiding full SDP renegotiation cycles.
- **API / Compatibility**: Zero breaking changes to Paper/Velocity plugin telemetry or public APIs.
