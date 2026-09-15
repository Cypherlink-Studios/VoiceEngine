## 1. Master Output Limiter & Bus Topology

- [x] 1.1 Instantiate `masterLimiter` as a `DynamicsCompressorNode` (-1.5 dB threshold, 3 dB knee, 20:1 ratio, 2ms attack, 50ms release) and wire between `masterGain` and `deafenGain` in `web-client/src/audio/SpatialAudioPipeline.ts`.
- [x] 1.2 Verify loopback and media routing cleanly flow through the master bus limiter without distortion.

## 2. Atmospheric Distance Acoustic Absorption

- [x] 2.1 Implement distance calculation and atmospheric frequency rolloff curve (20 kHz down to 3.5 kHz) in `SpatialAudioPipeline.ts:updatePeerPosition()`.
- [x] 2.2 Verify that submerged state overrides the distance absorption curve to 600 Hz cutoff and recovers smoothly when emerging from water.

## 3. Verification & Validation

- [x] 3.1 Run `npm run build` in `web-client` to verify zero TypeScript or Vite bundle errors.
- [x] 3.2 Run `openspec validate client-acoustic-processing-and-mastering --strict` to verify all OpenSpec requirements, deltas, and dependencies pass.
