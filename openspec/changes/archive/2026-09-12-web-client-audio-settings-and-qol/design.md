## Context

See [proposal.md](file:///C:/Users/antua/OneDrive/Documentos/Programming/MISC/VoiceEngine/openspec/changes/web-client-audio-settings-and-qol/proposal.md) for motivation and problem background.

Currently, the web client initializes `SpatialAudioPipeline` with default browser constraints and binds directly to `audioContext.destination`. All peers are rendered at a uniform fixed base gain (with 3D distance attenuation or unattenuated fixed channel routing). There is no UI to switch hardware devices, inspect or adjust peer volumes, preview microphone levels, or receive audio feedback for interface actions.

## Goals / Non-Goals

**Goals:**
- Provide hardware device selection for input microphones and output headphones/speakers with `localStorage` persistence.
- Allow dynamic hot-swapping of microphone tracks via Mediasoup's `producer.replaceTrack` without reconnecting or renegotiating WebRTC transports.
- Implement per-user volume control (0% to 200%) and local mute toggling stored in `localStorage`.
- Implement lightweight procedural sound effects using Web Audio API oscillators (no external MP3/WAV assets).
- Add keyboard accessibility shortcuts (`M` for mute, `Escape` to close overlays) with input focus suppression.
- Measure and display round-trip network latency via periodic WebSocket ping/pong messages.
- Provide a modular, accessible Settings modal in the player interface.

**Non-Goals:**
- Push-To-Talk (PTT) mode: Explicitly excluded as requested; voice activation detection (VAD) remains the primary input mode.
- Server-side forced volume muting/moderation: Individual volume attenuation and muting are strictly client-side local controls.
- Cloud-synced user preferences: Device IDs and local player volumes are stored in browser `localStorage`.

## Decisions

### Decision 1: Mediasoup Producer Track Hot-Swapping over Session Reconnection
- **Rationale**: Reconnecting the WebSocket or recreating WebRTC transports when the user picks a new microphone interrupts audio, generates audible disconnect/connect events, and wastes network bandwidth. Mediasoup's `producer.replaceTrack({ track: newTrack })` handles RTP stream updates on the fly without interrupting listeners.
- **Alternatives Considered**: Disconnecting and reconnecting `VoiceSignaling` (disruptive and causes visual radar flickering).

### Decision 2: AudioContext Output Routing via `setSinkId` with Graceful Fallback
- **Rationale**: Modern Chromium-based browsers (Chrome, Edge, Brave, Opera) and recent Firefox implementations support `AudioContext.setSinkId(sinkId)`. This routes the entire Web Audio rendering graph to the chosen physical speakers or headset.
- **Alternatives Considered**: Attaching audio to dummy `<audio>` elements for output sink routing. This is unnecessary and adds audio pipeline complexity because `AudioContext.setSinkId` is now standard in Web Audio Level 2.
- **Fallback**: If `setSinkId` is not supported on the browser's `AudioContext`, the selector gracefully informs the user that the default system device is used.

### Decision 3: Procedural Audio Synthesis for Sound Effects
- **Rationale**: Using small procedural synth routines (`OscillatorNode` with linear/exponential gain ramps) guarantees 0ms load latency, requires no network requests, prevents 404 asset failures, and has zero bundle weight.
- **Alternatives Considered**: Serving static `.mp3` or `.ogg` sound files from the backend (requires network caching and increases deployment complexity).

### Decision 4: Local Storage Partitioning for Peer Volume Multipliers
- **Rationale**: Storing `{ [uuid]: volume }` and `{ [uuid]: isMuted }` in `localStorage` under `voiceengine:user_preferences` allows the client to remember if a friend speaks quietly across distinct gameplay sessions.
- **Alternatives Considered**: In-memory only state (resets every time the player refreshes).

### Decision 5: WebSocket Round-Trip Time (RTT) Probe vs RTCP Transport Stats
- **Rationale**: Periodically sending `{ type: 'ping', timestamp }` every 3 seconds over the active WebSocket control channel and echoing it back with `{ type: 'pong', timestamp }` measures end-to-end signaling latency, which accurately reflects server responsiveness. WebRTC transport statistics (`getStats()`) are also checked as a secondary diagnostic.

## Component Architecture

```
+--------------------------------------------------------------------------+
|                            PlayerRoute.tsx                               |
+--------------------------------------------------------------------------+
|  State: masterVolume, vadThreshold, isSpeaking, activePeers, pingMs      |
|  Refs: pipelineRef, signalingRef, micStreamRef, vadRef                   |
|                                                                          |
|  +---------------------+   +---------------------+  +-----------------+  |
|  |     Radar.tsx       |   |  ChannelDrawer.tsx  |  | ControlDock.tsx |  |
|  | - Avatar head click |   | - Member row click  |  | - Settings btn  |  |
|  |   -> open popover   |   |   -> open popover   |  | - Ping badge    |  |
|  +---------------------+   +---------------------+  +-----------------+  |
|               \                       /                      |           |
|                \                     /                       |           |
|                 v                   v                        v           |
|           +-------------------------------+       +--------------------+ |
|           |    PlayerVolumePopover.tsx    |       | SettingsModal.tsx  | |
|           | - Volume slider (0-200%)      |       | - Dispositivos     | |
|           | - Local mute button           |       | - Jugadores        | |
|           +-------------------------------+       | - Preferencias     | |
|                           |                       +--------------------+ |
|                           \                                  /           |
|                            v                                v            |
|                       +---------------------------------------+          |
|                       |         SpatialAudioPipeline          |          |
|                       | - setPeerVolume(uuid, volume)         |          |
|                       | - setPeerMuted(uuid, muted)           |          |
|                       | - setOutputDevice(sinkId)             |          |
|                       +---------------------------------------+          |
+--------------------------------------------------------------------------+
```

## Risks / Trade-offs

- **[Risk] `setSinkId` browser compatibility**: Older browsers or certain mobile browsers may throw or lack `setSinkId`.
  - *Mitigation*: Feature-detect `if ('setSinkId' in audioContext)` before invoking. Display a tooltip/notice if output device routing is unavailable on the client's browser.
- **[Risk] Multiple rapid microphone switches**: Rapidly clicking different microphones in the dropdown could trigger race conditions in `getUserMedia` promises.
  - *Mitigation*: Debounce device switching, disable the dropdown while stream acquisition and track replacement are in progress, and ensure previous unused tracks are stopped.
- **[Risk] Keyboard shortcut collisions**: Pressing `M` while typing in a search bar or text input would toggle mute unintentionally.
  - *Mitigation*: Inspect `event.target` in the global `keydown` listener; suppress the shortcut if the target is an `HTMLInputElement`, `HTMLTextAreaElement`, or has `isContentEditable`.
