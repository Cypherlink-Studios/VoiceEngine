## 1. Web Client Audio Pipeline Resumption

- [x] 1.1 Implement atomic `MediaStreamAudioSourceNode` refresh in `SpatialAudioPipeline.ts` on unpause and `track.onunmute`, and verify existing node graphs are preserved.
- [x] 1.2 Update persistent audio sink to `volume = 0.0001` and add background `AudioContext.resume()` handling in `SpatialAudioPipeline.ts`.
- [x] 1.3 Update `VoiceSignaling.ts` to preserve `peerUsername` during `peer_spatial_update` unpausing events.

## 2. Voice Server Gateway Hardening

- [x] 2.1 Include `peerUsername` in `peer_spatial_update` payloads in `ClientGateway.ts` and verify message shape.
- [x] 2.2 Add producer ID validation (`consumer.producerId === speakerSession.producer.id`) in `ClientGateway.ts` proximity routing to prevent stale consumers.

## 3. Verification & Validation

- [x] 3.1 Update and run `voice-server/test/ClientGateway.test.ts` to verify `peerUsername` propagation and consumer resumption (`npm test`).
- [x] 3.2 Execute typecheck and builds across `voice-server` and `web-client` (`npm run build`).
- [x] 3.3 Validate change artifacts using `openspec validate fix-proximity-audio-reentry-resumption`.
