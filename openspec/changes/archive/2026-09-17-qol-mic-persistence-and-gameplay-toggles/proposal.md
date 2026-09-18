# Proposal: QoL Microphone Persistence and Configurable Gameplay Mechanics

## Why

Currently, the web client resets the player's microphone mute state to unmuted (alse) upon disconnect, page refresh, or new sessions, creating an unintended hot mic privacy hazard where players who previously muted themselves unexpectedly broadcast audio upon reconnecting. Furthermore, gameplay-altering features introduced by the Paper Minecraft plugin (whispering while sneaking, underwater audio muffling, floating speaking note particles, and speaker blocks) are hardcoded without administrative configuration toggles, and spectators or dead players can broadcast voice to living players, disrupting competitive, hardcore, or roleplay game modes.

Introducing local microphone state persistence in the web client and master administrative toggles in the Paper plugin configuration resolves these privacy and customization bottlenecks without breaking backward compatibility.

## What Changes

- **Web Client Microphone Persistence**: Persist the user's microphone mute state in localStorage under key oiceengine:mic_muted. When joining or reconnecting, initialize the audio input pipeline directly into the saved mute state with zero audio leakage. Preserve this state across disconnects, and gracefully restore it after deafen/undeafen cycles without persisting administrative moderation mutes.
- **Configurable Plugin Mechanics**: Add an in-game mechanics configuration block (mechanics:) to config.yml allowing server administrators to independently enable or disable:
  - whisper-on-sneak: Toggle radius reduction (8 blocks) when crouching.
  - underwater-acoustics: Toggle low-pass muffled acoustics when submerged in water.
  - speaking-particles: Toggle musical note particles (Particle.NOTE) floating over speaking players' heads.
  - spectator-mode: Configurable spectator voice handling (ll, listen-only, or isolated).
- **Configurable Speaker Block Subsystem**: Add an explicit speakers: configuration section to config.yml with master enabled and particles-enabled switches for Jukebox speaker blocks.
- **Spectator Voice Routing in SFU**: Extend PlayerSpatialState and SpatialEngine to recognize spectator status and enforce the configured spectator voice isolation (e.g. listen-only prevents living players from hearing spectators while allowing spectators to hear proximity voice).
- **Dynamic Configuration Reloading**: Ensure /voice reload reloads and immediately applies all mechanic toggles and speaker states without requiring a server reboot.

## Capabilities

### Modified Capabilities

- web-client-spatial-audio: Update voice capture and input management requirements to persist microphone mute state across page reloads and sessions, guarding against hot mics upon connection.
- paper-voice-bridge: Update plugin configuration, telemetry streaming, and visual feedback requirements to allow administrators to independently toggle gameplay mechanics (whisper on sneak, underwater submersion acoustics, speaking note particles, spectator modes, and speaker blocks).
- oice-backend-sfu: Update spatial proximity culling and state dispatch requirements to support spectator voice routing policies (listen-only, isolated, ll).

## Impact

- **Web Client**: web-client/src/routes/PlayerRoute.tsx (localStorage read/write on mute toggles, connection initialization, and disconnect preservation).
- **Paper Plugin**: paper-plugin/src/main/resources/config.yml, paper-plugin/src/main/java/com/voiceengine/config/VoiceConfig.java, paper-plugin/src/main/java/com/voiceengine/telemetry/TelemetryCollector.java, paper-plugin/src/main/java/com/voiceengine/telemetry/PlayerSpatialState.java, paper-plugin/src/main/java/com/voiceengine/visual/SpeechFeedbackHandler.java, paper-plugin/src/main/java/com/voiceengine/speaker/SpeakerManager.java, and paper-plugin/src/main/java/com/voiceengine/VoiceEnginePlugin.java.
- **Voice Server**: oice-server/src/types.ts (isSpectator?: boolean) and oice-server/src/spatial/SpatialEngine.ts (spectator proximity evaluation).
- **Documentation**: docs/plugin/paper/configuration.md.
