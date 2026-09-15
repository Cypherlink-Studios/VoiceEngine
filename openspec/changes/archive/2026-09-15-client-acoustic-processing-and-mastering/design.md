## Context

`SpatialAudioPipeline.ts` routes proximity peer audio through a chain of `source -> filter -> panner -> gain -> proximityBusGain -> masterGain -> deafenGain -> destination`. Currently, the `filter` node only switches between 20,000 Hz and 600 Hz based solely on whether the peer is submerged, missing the natural high-frequency loss that occurs through air over distance. In addition, `masterGain` directly connects to `deafenGain` without any dynamic range limiting, making the output susceptible to harsh digital clipping whenever multiple speakers talk simultaneously.

See `proposal.md` for problem statement and motivation.

## Goals / Non-Goals

**Goals:**
- Provide realistic acoustic distance cues via atmospheric high-frequency absorption filtering.
- Prevent digital audio clipping and headphone distortion across overlapping proximity voices and background media.
- Maintain seamless backwards compatibility with submerged acoustic damping and stereo broadcast bypass.

**Non-Goals:**
- Heavy algorithmic reverb or raytraced room reflections (deferred to future expansion).
- Server-side CPU spatial audio rendering (rendering remains client-side in Web Audio).

## Decisions

### 1. Distance-Based Atmospheric Absorption Formula
- **Choice**: Calculate Euclidean distance $d = \sqrt{relX^2 + relY^2 + relZ^2}$.
  When `isSubmerged` is false:
  $$t = \frac{\min(\max(d - 2, 0), 28)}{28}$$
  $$f_{\text{cutoff}}(d) = 20000 \cdot \left(\frac{3500}{20000}\right)^t \text{ Hz}$$
  Apply with `filter.frequency.setTargetAtTime(targetFreq, now, 0.08)`.
- **Rationale**: Exponential frequency rolloff models the physical absorption coefficient of air (higher frequencies absorb faster than lower frequencies), creating depth and separation.
- **Alternatives Considered**: Linear interpolation in Hz (sounds unnatural because human pitch perception is logarithmic).

### 2. Master Bus Limiter Node
- **Choice**: Create a dedicated `DynamicsCompressorNode` (`masterLimiter`) inserted between `masterGain` and `deafenGain`:
  ```typescript
  masterLimiter.threshold.setValueAtTime(-1.5, this.audioContext.currentTime);
  masterLimiter.knee.setValueAtTime(3.0, this.audioContext.currentTime);
  masterLimiter.ratio.setValueAtTime(20.0, this.audioContext.currentTime);
  masterLimiter.attack.setValueAtTime(0.002, this.audioContext.currentTime);
  masterLimiter.release.setValueAtTime(0.050, this.audioContext.currentTime);
  ```
- **Rationale**: Acts as a transparent brickwall limiter. The 2ms attack catches fast plosive transients, the -1.5 dB threshold prevents DAC inter-sample peaks, and the 50ms release prevents audible pumping.
- **Alternatives Considered**: Soft-clipping Waveshaper curve (adds harmonic distortion, whereas compressor preserves clean audio fidelity).

## Risks / Trade-offs

- **[Risk]** Updating filter frequency on every spatial position tick could consume extra CPU.
  - *Mitigation*: The position update is already throttled to ~100ms ticks, and `setTargetAtTime` is a hardware-accelerated C++ Web Audio primitive with near-zero overhead.
