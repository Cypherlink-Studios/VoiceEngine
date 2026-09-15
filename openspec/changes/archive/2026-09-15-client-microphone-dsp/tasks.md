## 1. RNNoise AudioWorklet & WebAssembly Asset Setup

- [x] 1.1 Provide self-contained RNNoise WebAssembly binary and `rnnoise-processor.js` worklet script under `web-client/public/audio/` and verify assets resolve cleanly in Vite dev/build.

## 2. Core Microphone DSP Pipeline

- [x] 2.1 Implement `MicrophonePipeline.ts` managing a dedicated 48kHz `AudioContext`, `MediaStreamAudioSourceNode`, 80Hz high-pass biquad filter, and `MediaStreamAudioDestinationNode`.
- [x] 2.2 Implement `AudioWorkletNode` instantiation for RNNoise with 10ms (480 samples) frame buffering, real-time speech probability callback emission, and live bypass toggling.
- [x] 2.3 Implement smooth exponential gain envelope gating (~15ms attack/release) and input gain (0-200%) with soft-knee peak compressor/limiter.
- [x] 2.4 Implement graceful fallback to native Web Audio HPF + RMS volume VAD when WebAssembly or AudioWorklet fails to load.

## 3. WebRTC Upstream & Route Integration

- [x] 3.1 Refactor `PlayerRoute.tsx` to initialize and bind `MicrophonePipeline`, passing the processed track to `sendTransport.produce()`.
- [x] 3.2 Wire runtime input device switching and mute/deafen states to `MicrophonePipeline` without dropping the WebRTC session.

## 4. UI & Settings Modal Controls

- [x] 4.1 Add AI Noise Suppression (RNNoise) toggle, input gain slider (0-200%), and hybrid sensitivity slider to `SettingsModal.tsx`.
- [x] 4.2 Upgrade the VU meter in `SettingsModal.tsx` and the dock waveform to display neural speech probability indicators alongside RMS volume.
- [x] 4.3 Route the loopback test in `SettingsModal.tsx` through `MicrophonePipeline` so players can audition their processed voice and noise suppression live.

## 5. Verification & Validation

- [x] 5.1 Run `npm run build` in `web-client` and verify zero TypeScript or Vite bundle compilation errors.
- [x] 5.2 Verify `openspec validate client-microphone-dsp --strict` passes with all deltas, dependencies, and requirements satisfied.
