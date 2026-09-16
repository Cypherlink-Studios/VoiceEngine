# Proposal: Fix Web Client Background VAD and Muted Particle Emission

## Why
When players minimize the web client browser tab to focus on Minecraft without having the Document PiP overlay open, voice activity detection halts completely because its monitoring loop is driven by `requestAnimationFrame`, causing microphone capture and audio transmission to cease. Additionally, when a player speaks while muted in the web client, the client erroneously sends speech notification frames to the signaling server, causing the Minecraft Paper plugin to render musical note particles above the player's head even though their audio is muted.

Fixing these two bugs restores uninterrupted background voice communication while playing Minecraft in full-screen or minimized mode, and ensures visual speech feedback in-game accurately reflects actual audible transmission.

## What Changes
- **Unthrottled Background VAD Clock**: Decouple the voice activity detection and audio gate evaluation loop in `MicrophonePipeline` from `requestAnimationFrame` by introducing a Web Worker timer (with resilient fallback) and tapping into real-time `AudioWorklet` VAD events, ensuring audio is captured and transmitted continuously when the tab is hidden or minimized.
- **Timestamp-Based Hangover Timing**: Replace `setTimeout` hangover timers in `MicrophonePipeline` with monotonic timestamp comparisons (`performance.now()`), eliminating timer throttling artifacts in background tabs.
- **Mute & Deafen Speaking Suppression**: Synchronize `notifySpeaking` in `PlayerRoute` and `VoiceSignaling` to transmit `speaking = true` only when audio transmission is permitted (`speaking && !isMuted && !isDeafened`).
- **Backend Moderation Defense-in-Depth**: Ensure `ClientGateway` in the voice server drops `speaking` notifications and does not dispatch `speech_status` to Paper or radio channels if the session is muted by server moderation.
- **Web UI Speaking Ring Consistency**: Ensure the local player's visual speaking indicator in the web client avatar and dock only shows speaking when unmuted.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `web-client-spatial-audio`: Update VAD input management requirements to specify unthrottled background execution regardless of tab visibility, and update mute/deafen requirements to strictly suppress speech notifications to the server and in-game visual indicators while muted.
- `voice-backend-sfu`: Update speech status routing requirements to ensure muted sessions (moderation or self-reported) cannot broadcast active speech status to Paper servers or radio channels.

## Impact
- **Affected Files**:
  - `web-client/src/audio/MicrophonePipeline.ts`: Replace `requestAnimationFrame` loop with background-resilient worker/interval ticker and timestamp hangover.
  - `web-client/src/routes/PlayerRoute.tsx`: Gate `notifySpeaking` by `canTransmit` (`!isMuted && !isDeafened`), centralize synchronization in `updateAudioTransmission`.
  - `voice-server/src/gateway/ClientGateway.ts`: Guard `speaking` message handling against `session.isMuted`.
- **APIs and Protocols**: No breaking changes to existing binary or JSON protocol schemas; payload formats remain identical.
- **Dependencies**: No new external dependencies required; utilizes standard Web Workers (`Blob` URL) and Web Audio API.
