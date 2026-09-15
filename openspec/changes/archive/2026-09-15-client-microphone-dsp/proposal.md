# Proposal: Client-Side Microphone DSP & Neural Noise Suppression

## Why

Currently, the web client transmits raw microphone audio directly to WebRTC, relying entirely on basic browser noise suppression and a rudimentary RMS volume threshold for VAD. This causes mechanical keyboard clicks, PC fans, background room noise, and desk vibrations to trigger voice transmission and degrade audio clarity, while sudden mute/unmute transitions create audible clicks.

## What Changes

- Introduce a dedicated client-side audio input DSP pipeline (`MicrophonePipeline`) processing microphone streams at 48kHz before WebRTC transmission.
- Integrate **RNNoise** neural noise suppression running in a dedicated `AudioWorkletNode` compiled to WebAssembly to eliminate background noise, keystrokes, and ambient hum in real time with zero UI lag.
- Implement an **80Hz High-Pass Filter (HPF)** to eliminate subsonic rumble, desk bumps, wind noise, and proximity plosives.
- Replace simple RMS volume detection with a **Hybrid AI Voice Activity Detector (VAD)** combining neural speech probability ($P_{voice} > 0.65$) with an adjustable sensitivity threshold.
- Implement a **Smooth Envelope Gain Gate** with exponential attack and release ramps (~15ms) to eliminate digital audio clicks and popping when voice activation toggles.
- Add an **Input Gain Control (0%–200%)** with a soft-knee peak compressor/limiter to prevent digital clipping before Opus encoding.
- Provide a robust **graceful fallback mechanism** that reverts seamlessly to standard native browser constraints if WebAssembly or AudioWorklet is unavailable in the environment.
- Upgrade `SettingsModal` and the control dock UI to provide real-time speech probability feedback, a toggle for AI noise suppression, and a unified microphone sensitivity control.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-client-spatial-audio`: Upgrades microphone acquisition and VAD requirements with client-side DSP stages including 80Hz high-pass filtering, RNNoise neural noise suppression via AudioWorklet, smooth gain envelope gating, hybrid speech probability VAD, and fallback behavior.

## Impact

- **Affected Code**: `web-client/src/audio/` (`MicrophonePipeline.ts`, `VoiceActivityDetector.ts`), `web-client/src/routes/PlayerRoute.tsx`, `web-client/src/components/player/SettingsModal.tsx`, `web-client/src/net/VoiceSignaling.ts`.
- **Dependencies**: Bundled lightweight RNNoise WASM binary and worklet processor (self-contained in `web-client/public/audio/` or inline assets, avoiding heavy external runtime overhead).
- **APIs & Protocols**: No backend or SFU protocol breaking changes; upstream WebRTC media stream format remains standard Opus 48kHz.
