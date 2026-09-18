# Technical Design: QoL Microphone Persistence and Configurable Gameplay Mechanics

## Context

See `proposal.md` for the motivation. The web client currently initializes with `isMuted = false` on every mount and resets state upon disconnection. The Paper Minecraft plugin continuously emits telemetry containing `player.isSneaking()` and `player.isInWater()` and renders floating note particles on a fixed interval without administrative config switches. Furthermore, spectators and dead players are treated identically to alive players in proximity audio calculations.

## Goals / Non-Goals

**Goals:**
- Eliminate hot-mic hazards by persisting user mute state in `localStorage` (`voiceengine:mic_muted`) and initializing WebRTC tracks and audio worklets directly into the persisted state.
- Provide clean administrative switches in `config.yml` for sneak whispering, underwater acoustics, speaking note particles, spectator modes (`all`, `listen-only`, `isolated`), and speaker blocks.
- Enable unidirectional and isolated proximity routing for spectators in the backend `SpatialEngine`.
- Ensure instant in-game reloadability via `/voice reload` without server restart.

**Non-Goals:**
- Creating a server-side web admin UI for player mute preferences (this remains a client-local preference).
- Changing the Opus encoder or RNNoise AudioWorklet signal processing algorithms.
- Modifying Velocity proxy forwarding protocols (Paper handles telemetry and local mechanics).

## Decisions

### Decision 1: Client Microphone Persistence and Lifecycle Integration
- **Approach**: Read `voiceengine:mic_muted` on `PlayerRoute` mount. Maintain `isMutedRef` synchronized with the boolean state. When initializing `MicrophonePipeline` in `handleConnect`, apply `micPipeline.setMuted(initialMuted)` and ensure `sendTrack.enabled = false` when muted before any audio frames can be captured or sent.
- **Deafen Handling**: When deafened, store previous `isMuted` in memory; upon undeafening, restore the saved preference from `localStorage`.
- **Moderation Handling**: Server-enforced mutes (`moderationNotice`) toggle memory/pipeline state but NEVER overwrite `localStorage`.
- **Disconnect Handling**: `handleDisconnect` clears session artifacts (peers, channels, pings) but explicitly preserves `isMuted` and `isMutedRef`.
- **Alternatives Considered**: 
  - *Dedicated "Always start muted" checkbox*: Requires extra user interaction and adds UI clutter. Direct state persistence matches modern expectations (Discord, Teams, Zoom).

### Decision 2: Paper Plugin Configuration Architecture
- **Approach**: Introduce `mechanics:` and `speakers:` YAML sections in `config.yml` and map them to immutably typed record fields in `VoiceConfig.java`:
  ```yaml
  mechanics:
    whisper-on-sneak: true
    underwater-acoustics: true
    speaking-particles: true
    spectator-mode: "listen-only" # all | listen-only | isolated
  speakers:
    enabled: true
    particles-enabled: true
  ```
- **Fallback Defaults**: Defaults preserve existing behavior (`whisper-on-sneak: true`, `underwater-acoustics: true`, `speaking-particles: true`, `speakers.enabled: true`, `speakers.particles-enabled: true`, and `spectator-mode: "listen-only"`).

### Decision 3: Telemetry & Spatial Spectator Isolation
- **Approach**: 
  - In `PlayerSpatialState.java`, add `isSpectator` boolean derived from `player.getGameMode() == GameMode.SPECTATOR || player.isDead()`.
  - When `whisperOnSneak` is disabled, `isSneaking` is transmitted as `false`.
  - When `underwaterAcoustics` is disabled, `isSubmerged` is transmitted as `false`.
  - In `voice-server/src/types.ts`, add `isSpectator?: boolean` to `PlayerSpatialState`.
  - In `SpatialEngine.ts`:
    - If `spectatorMode === 'listen-only'`: Living listeners ignore audio from spectator speakers (`if (speaker.isSpectator && !listener.isSpectator) return;`), but spectator listeners still calculate relative 3D audio for living speakers.
    - If `spectatorMode === 'isolated'`: Living players and spectators never hear each other (`if (speaker.isSpectator !== listener.isSpectator) return;`).
    - If `spectatorMode === 'all'`: Standard distance calculations apply to all.

### Decision 4: Speaker Block Master Switch
- **Approach**: In `SpeakerManager.java`, check `voiceConfig.speakersEnabled()`. When `false`, `load()`, `save()`, and redstone updates become no-ops, and `SpeakerCommands` replies with a localized/formatted message indicating speaker blocks are disabled.

## Risks / Trade-offs

- **[Risk: User forgets they were muted in a prior session]** → The web client provides high-visibility visual indicators: red mic icon in dock, PiP overlay, and control panel showing muted status.
- **[Risk: Spectators in listen-only consuming excess compute]** → Spectators only act as listeners. They do not transmit audio packets to alive players, and spatial calculations use existing fast deadband and squared-distance culling.
- **[Risk: Reloading configuration during active voice call]** → `reloadPlugin()` synchronously updates configuration fields, tick rates, and manager state in-place without dropping WebSocket connections to the voice backend.

## Migration Plan

1. Deploy updated `config.yml` template with annotated `mechanics:` and `speakers:` sections.
2. Existing configurations lacking the new sections automatically fall back to safe defaults without parsing errors.
3. Deploy updated `web-client`, `voice-server`, and `paper-plugin` builds.
