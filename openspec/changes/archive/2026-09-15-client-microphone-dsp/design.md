# Design: Client-Side Microphone DSP & Neural Noise Suppression

## Context

The web client currently captures microphone audio through `navigator.mediaDevices.getUserMedia` and directly produces an un-processed clone of the hardware audio track into the Mediasoup WebRTC send transport (`sendTransport.produce({ track: sendTrack })`). Voice activity detection is implemented via `requestAnimationFrame` polling an `AnalyserNode` for RMS volume.

While effective for clean environments, this architecture suffers from:
1. Lack of acoustic filtering: Desk bumps, PC fan hum, keyboard switches, and breath pops pass unimpeded.
2. Fragile VAD: High-volume non-speech sounds trigger the transmission gate.
3. Audible clicks: Toggling `sendTrack.enabled` instantly creates abrupt wave cutoffs.

## Goals / Non-Goals

**Goals:**
- Decouple and encapsulate all microphone acquisition, processing, and VAD into a dedicated `MicrophonePipeline` class.
- Run RNNoise neural noise suppression inside a dedicated `AudioWorkletNode` compiled to WebAssembly (48kHz, 10ms frame size, zero main-thread UI blocking).
- Pre-filter microphone input through an 80Hz High-Pass Filter (HPF) to eliminate subsonic mechanical rumble.
- Implement a Hybrid VAD combining RNNoise neural speech probability ($P_{voice} \ge 0.65$) with volume gating and smooth exponential attack/release gain ramps (~15ms).
- Provide an input gain multiplier (0% to 200%) and soft-knee peak compressor/limiter.
- Maintain automatic graceful degradation if WebAssembly or AudioWorklet is unsupported.
- Upgrade `SettingsModal` and the reactive dock to expose AI noise suppression toggles, microphone gain, and dual VU/probability metrics.

**Non-Goals:**
- Server-side audio processing or transcoding on the Mediasoup SFU (all DSP remains strictly client-side).
- Output bus modifications (Master Limiter, atmospheric absorption, and radio effects belong to Phase 3).
- SFU-level Opus FEC and DTX configuration (belongs to Phase 2).

## Decisions

### Decision 1: AudioWorklet + WebAssembly vs ScriptProcessorNode
- **Choice**: Execute RNNoise within an `AudioWorkletProcessor` backed by a compact WebAssembly module.
- **Rationale**: `ScriptProcessorNode` runs on the browser's main UI thread, causing frequent buffer underruns, clicks, and pops whenever React renders or the user interacts with the DOM. `AudioWorkletNode` executes in the browser's dedicated high-priority audio rendering thread.
- **Alternatives Considered**: 
  - Main thread Worker postMessage: Introduces significant inter-thread latency (>20ms) and audio buffer copying overhead.
  - Browser-native WebRTC noise suppression only: Highly inconsistent across browsers (e.g. Linux Chromium vs macOS Safari) and incapable of filtering mechanical keyboard clicks.

### Decision 2: Self-Contained Assets in `public/audio/`
- **Choice**: Bundle the compiled RNNoise WebAssembly binary (`rnnoise.wasm`) and the worklet processor script (`rnnoise-processor.js`) in `web-client/public/audio/`.
- **Rationale**: Avoids heavy npm runtime dependencies or external CDN fetch calls that can fail behind strict firewalls or offline networks. Enables instant browser HTTP caching and predictable asset resolution.

### Decision 3: Standardized 48kHz AudioContext
- **Choice**: Initialize the input `AudioContext` with `{ sampleRate: 48000, latencyHint: 'interactive' }`.
- **Rationale**: RNNoise's neural network weights and frame processing are tuned for 480-sample blocks (10ms at 48kHz). Running at 48kHz matches the Opus codec native clock rate, eliminating resampler distortion or phase mismatch during WebRTC packetization.

### Decision 4: Smooth Gain Envelope vs Instant Track Disabling
- **Choice**: Implement a `GainNode` with exponential smoothing (`setTargetAtTime` with a 15ms time constant) before routing to `MediaStreamAudioDestinationNode`.
- **Rationale**: Instantly setting `track.enabled = false` cuts the audio waveform abruptly mid-cycle, creating a high-frequency transient click audible to listeners. Ramping the gain to zero over 15ms attenuates the signal below audibility before silencing packet transmission.

### Decision 5: Hybrid Neural VAD Architecture
- **Choice**: Combine the RNNoise output speech probability ($P_{voice} \in [0.0, 1.0]$) with a baseline volume threshold.
- **Rationale**: Neural VAD accurately isolates human voice from background noise, but can trigger on very faint distant voices in a noisy room. The baseline volume gate ensures that whisper-quiet room chatter below the calibrated sensitivity threshold does not open the channel.

### Decision 6: Resilient Fallback Architecture
- **Choice**: Wrap AudioWorklet module loading and WASM compilation in a try-catch block during pipeline initialization.
- **Rationale**: If a browser environment restricts WebAssembly or AudioWorklet, `MicrophonePipeline` silently falls back to standard Web Audio HPF + RMS volume VAD with native browser constraints, logging an informative warning and updating the UI state.

## Risks / Trade-offs

- **[Risk]** RNNoise processing adds input latency.  
  → **Mitigation**: RNNoise processes audio in 10ms chunks (480 samples at 48kHz). Total added algorithmic latency is between 10ms and 15ms, well within the 100ms threshold for interactive real-time voice chat.
- **[Risk]** Increased CPU usage on low-power mobile devices.  
  → **Mitigation**: RNNoise WASM is lightweight (~1-2% single-core on modern hardware). Users can toggle AI suppression off in `SettingsModal` at any time, returning CPU usage to near zero.
- **[Risk]** Hot-swapping input devices while AudioWorklet is running.  
  → **Mitigation**: `MicrophonePipeline.setInputDevice()` re-creates the `MediaStreamSourceNode` and reconnects it to the existing high-pass filter and worklet chain without tearing down the entire `AudioContext` or WebRTC transport.
