# Design: Web Client & UX Enhancements

## Context

VoiceEngine's client architecture separates in-game player telemetry from browser-side WebRTC audio rendering. In single-monitor or mobile setups, browser limitations (tab backgrounding, lack of global keyboard hooks when Minecraft is focused, device screen timeouts) create UX barriers. See `proposal.md` for motivation and `specs/web-client-spatial-audio/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Provide a native, always-on-top floating radar and control dock using the Document Picture-in-Picture API.
- Deliver an effortless mobile companion experience with instant QR handoff, Screen Wake Lock, and haptic vibration feedback.
- Give users a clear microphone calibration/loopback test in settings with live VAD threshold meters.
- Implement Deafen mode (audio input mute + master output attenuation) with keyboard shortcuts and procedural audio feedback.
- Provide a Streamer Mode toggle for privacy and anti-sniping.
- Implement proximity audio ducking during active radio channel transmissions and seamless radar avatar interactions.

**Non-Goals:**
- Global OS-level keyboard hooks while Minecraft is focused without mods (Push-to-Talk is explicitly excluded).
- Modifying Minecraft server plugins or SFU backend protocols (all enhancements are client-side Web / Web Audio API capabilities).

## Decisions

### 1. Document Picture-in-Picture Integration
- **Approach**: Use `window.documentPictureInPicture.requestWindow({ width: 340, height: 440 })`. Copy all document stylesheets into the PiP window's `<head>` and use a React portal (`createPortal`) to render the mini radar and control buttons into the PiP window.
- **Alternatives Considered**:
  - `window.open` popup: Rejected because standard popups cannot stay "always-on-top" over a focused Minecraft window and are often blocked by pop-up blockers.
  - Video `<canvas>` PiP: Rejected because standard video PiP does not allow interactive buttons or volume sliders.

### 2. Mobile Companion QR Code & Wake Lock
- **Approach**:
  - Generate a scannable QR code directly from the current URL (including token) rendered into an SVG/canvas modal.
  - On mobile browsers, invoke `navigator.wakeLock.request('screen')` during active connection. Re-request lock on `visibilitychange` if the tab is backgrounded and restored.
  - Use `navigator.vibrate([40])` for mute/unmute and `[30, 40, 30]` for deafen.
- **Alternatives Considered**: Polling video playback hacks to keep mobile screens on. Rejected as `navigator.wakeLock` is now widely supported in modern mobile browsers.

### 3. Microphone Loopback & Visual Calibration
- **Approach**:
  - Create a temporary loopback branch in `SpatialAudioPipeline`: `localMediaStreamSource -> DelayNode(200ms) -> GainNode(loopbackVolume) -> audioContext.destination`.
  - The delay prevents acoustic feedback while allowing the user to hear their true voice inflection.
  - An `AnalyserNode` calculates RMS amplitude, which is rendered in the settings UI alongside the VAD sensitivity slider threshold marker so the user visually sees when their voice triggers transmission.

### 4. Deafen Mode Pipeline Routing
- **Approach**:
  - Insert a `deafenGain: GainNode` in the audio pipeline just prior to `masterGain`.
  - When deafen is active, ramp `deafenGain.gain` to `0` over 50ms, and simultaneously disable the local microphone media track.
  - Add procedural sound effects in `SoundEffects.ts`: a falling tone sequence for deafen (`deafen.play()`) and an ascending chime for undeafen (`undeafen.play()`).
  - Bind the `D` key to toggle deafen when focus is not inside an `input` or `textarea`.

### 5. Streamer Privacy Masking
- **Approach**:
  - Store `streamerMode: boolean` in `localStorage`.
  - When enabled, `tokenInput` displays as `VOICE-••••-••••`, URL query params are obfuscated in the UI, and relative player coordinates (`relX`, `relY`, `relZ`) in the radar and popovers are masked as `(---, ---)`.

### 6. Proximity Audio Ducking for Radio Channels
- **Approach**:
  - When any peer flagged with `isChannel: true` transitions to `isSpeaking: true`, reduce proximity peer gain nodes by 50% (`userVol * 0.5`) using an exponential ramp `setTargetAtTime`.
  - When radio speech ends, ramp proximity peer gains back to their baseline.

## Risks / Trade-offs

- **[Document PiP Browser Support]** → Document Picture-in-Picture is currently supported in Chromium-based browsers (Chrome 116+, Edge, Opera, Brave). Firefox and Safari do not yet support document PiP.
  - *Mitigation*: Feature-detect `window.documentPictureInPicture !== undefined`. If unsupported, hide the button or display an informative tooltip without crashing or degrading core functionality.
- **[Screen Wake Lock Permissions & Tab Switches]** → Browsers automatically release wake locks if the tab becomes inactive.
  - *Mitigation*: Listen to `document.addEventListener('visibilitychange')` and re-acquire the wake lock when the page returns to visible.
- **[Microphone Feedback during Mic Test]** → If testing with open laptop speakers and mic, acoustic feedback could occur.
  - *Mitigation*: The 200ms delay and low default loopback gain (0.7) mitigate howling, accompanied by an in-UI reminder to use headphones during mic test.
