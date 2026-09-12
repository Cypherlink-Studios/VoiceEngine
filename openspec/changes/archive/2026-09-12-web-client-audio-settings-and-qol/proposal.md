## Why

Currently, the web client captures audio using the browser's default microphone and routes spatial sound exclusively to the default audio output without allowing players to choose their headsets, microphones, or audio processing parameters. Additionally, players lack quality-of-life (QoL) controls commonly expected in voice platforms, such as per-user volume adjustments, local mutes for loud peers, procedural audio feedback for voice state changes, accessible keyboard shortcuts, and real-time network latency indicators. Providing these controls significantly enhances player comfort, accessibility, and communication quality.

## What Changes

- **Audio Device Selection**: Allow users to enumerate and select specific input microphones (`audioinput`) and output devices (`audiooutput` via `setSinkId`), with live microphone testing and automatic hardware plug-and-play detection.
- **Audio Processing Toggles**: Enable players to toggle browser acoustic echo cancellation, noise suppression, and auto gain control according to their hardware setup.
- **Per-User Volume & Local Mute**: Allow players to adjust individual peer volume levels from 0% to 200% and toggle local mutes from the 3D Radar, the Channel Drawer, and the Settings modal, with persistence across sessions.
- **Procedural Sound Effects**: Provide low-latency, dependency-free audio feedback chimes generated via the Web Audio API for connection, disconnection, mute/unmute, and channel transitions.
- **Keyboard Shortcuts**: Provide a quick mute toggle bound to the `M` key (with input-focus suppression) and `Escape` modal dismissal.
- **Network Latency Telemetry**: Introduce a round-trip latency probe via WebSocket ping/pong messages to display live ping metrics in the control dock.
- **Settings Modal**: Introduce a clean, glassmorphic settings modal (`SettingsModal.tsx`) with modular tabs for Devices, Player Volumes, and System Preferences.

## Capabilities

### Modified Capabilities
- `web-client-spatial-audio`: Adds audio device selection, per-user gain control, procedural sound effects, keyboard shortcuts, and live connection telemetry to the web client.
- `voice-backend-sfu`: Adds lightweight WebSocket ping/pong frame handling in the client gateway to support round-trip latency calculation.

## Impact

- **Web Client**:
  - `web-client/src/audio/SpatialAudioPipeline.ts`: Extended with `setOutputDevice(sinkId)`, `setPeerVolume(uuid, volume)`, and `setPeerMuted(uuid, muted)`.
  - `web-client/src/audio/SoundEffects.ts`: New procedural Web Audio oscillator sound effect generator.
  - `web-client/src/net/VoiceSignaling.ts`: Added track replacement without renegotiation and WebSocket ping/pong telemetry.
  - `web-client/src/components/player/SettingsModal.tsx`: New comprehensive settings modal.
  - `web-client/src/components/player/ControlDock.tsx`: Added settings trigger button, ping latency badge, and shortcut tooltips.
  - `web-client/src/components/Radar.tsx` & `ChannelDrawer.tsx`: Integrated per-user volume popovers and sliders.
- **Voice Server**:
  - `voice-server/src/gateway/ClientGateway.ts`: Handle `ping` messages by responding immediately with `pong` and the client timestamp.
