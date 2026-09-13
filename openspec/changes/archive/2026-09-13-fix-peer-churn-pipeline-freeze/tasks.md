## 1. Backend Routing Isolation and Consumer Pause Lifecycle

- [x] 1.1 Refactor `ClientGateway.ts` `startProximityLoop()` into mutually exclusive `if (channel === 'proximity') { ... } else { ... }` branches and verify no proximity clients are evaluated as fixed-channel peers.
- [x] 1.2 Implement consumer pause/resume tracking in `ClientGateway.ts` for proximity distance culling (calling `consumer.pause()` when out of range and `consumer.resume()` when returning) instead of calling `consumer.close()`.
- [x] 1.3 Ensure `consumer.close()` is strictly reserved for explicit client disconnects (`cleanupSession()`) and channel switching (`join_channel`).
- [x] 1.4 Build `voice-server` and verify automated TypeScript compilation with `npm run build`.

## 2. Web Client Single Audio Sink and Pipeline Stream Optimization

- [x] 2.1 Refactor `SpatialAudioPipeline.ts` to use a single persistent muted `<audio>` element sink bound to a persistent MediaStream instead of instantiating and tearing down DOM audio elements per peer.
- [x] 2.2 Update `SpatialAudioPipeline.ts` `addPeerStream()` and `removePeerStream()` to retain node graphs during distance pausing and smoothly ramp gains rather than reconstructing PannerNode instances.
- [x] 2.3 Optimize `VoiceSignaling.ts` and `PlayerRoute.tsx` with throttled peer update dispatching to prevent main-thread UI lockups during rapid telemetry updates.
- [x] 2.4 Build `web-client` and verify TypeScript compilation and bundle generation with `npm run build`.

## 3. End-to-End Verification

- [x] 3.1 Run `voice-server` and verify with multiple simulated clients that player connects, disconnects, and distance crossings produce zero UI freezing, zero audio dropouts, and zero consumer thrashing in server logs.
