## Context

See `proposal.md` for motivation.

VoiceEngine links a vanilla Minecraft client (Java Edition) to a browser-based WebRTC SFU client. Currently, the Paper plugin streams positional batches to the Node.js backend over an authenticated WebSocket, while Velocity intercepts `/voice` commands in proxy mode. To introduce localized public-address broadcasting (Speaker Blocks), bulletproof config reloads, and centralized moderation with anti-evasion safeguards, modifications are coordinated across four subprojects (`paper-plugin`, `velocity-plugin`, `voice-server`, and `web-client`).

## Goals / Non-Goals

**Goals:**
- Deliver uniform 2D stereo acoustics for speaker blocks with direct audio routing priority over proximity.
- Provide a zero-downtime hot-reload for all `config.yml` properties, including `server-id` and authentication secrets.
- Establish Velocity proxy as the authoritative moderation master with SQLite persistence and real-time Mediasoup SFU synchronization.
- Implement a 4-layer anti-evasion defense preventing token sharing, phantom sessions, and multi-account abuse.

**Non-Goals:**
- Custom client-side Minecraft mods (all features remain strictly vanilla).
- Multi-region SFU mesh clustering or distributed database synchronization across cloud providers.
- In-game voice recording or playback of custom external audio files.

## Decisions

### Decision 1: 2D Uniform Broadcast Routing with PannerNode Bypass
- **Choice**: Deliver speaker block audio as unspatialized 2D stereo (constant volume across the entire radius, `relX: 0, relY: 0, relZ: 0`, flagged with `isBroadcast: true`).
- **Rationale**: Megaphones and PA systems for staff/events require pristine voice intelligibility without frequency or volume attenuation when listeners turn their heads.
- **Conflict Resolution**: If a listener is within range of both the speaker block and direct 3D proximity of the speaking player, the 2D broadcast signal takes precedence to prevent echo or phase cancellation.
- **Alternatives Considered**:
  - *Virtual 3D Sound Source*: Simulating the block as an audio emitter in 3D space with HRTF. Rejected because turning away from an announcement causes volume dropoff and disorientation during events.

### Decision 2: Velocity as Central Moderation Master with Local Standalone Fallback
- **Choice**: Place the authoritative SQLite database (`moderation.db`) and Cloud moderation commands on the Velocity proxy in proxy-enabled networks, with identical schema fallback in Paper for standalone servers.
- **Rationale**: Velocity intercepts token generation requests at network ingress, survives individual backend server restarts or crashes, and enforces network-wide sanctions without needing cross-server Redis/MySQL infrastructure.
- **Database Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS punishments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_uuid TEXT NOT NULL,
      player_name TEXT NOT NULL,
      client_ip TEXT,
      device_id TEXT,
      punishment_type TEXT NOT NULL, -- MUTE, DEAFEN, BAN
      reason TEXT,
      staff_uuid TEXT,
      staff_name TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER, -- NULL or 0 for permanent
      revoked INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_active_uuid ON punishments (player_uuid, punishment_type, revoked);
  ```
- **Alternatives Considered**:
  - *Storing in Voice Backend (Node.js)*: Adds database drivers and file state to the voice server, complicating ephemeral container deployments.
  - *Storing per Paper Server*: Creates desynchronization across proxy lobbies and minigames.

### Decision 3: Graceful WebSocket Teardown and Re-Handshake on `/voice reload`
- **Choice**: When `/voice reload` executes, explicitly call `VoiceBackendClient#shutdown()`, reload configurations, update `TokenManager` TTL, and instantiate a fresh `VoiceBackendClient` connecting with new headers (`X-Server-Id`, `Authorization`) and re-sending `plugin_handshake`.
- **Rationale**: Eliminates the stale socket issue where `serverId` or `secretKey` changes were ignored unless the JVM was restarted.

### Decision 4: 4-Tier Anti-Ban Evasion Protection
- **Choice**: Combine Token IP-Binding, Disconnect Presence Binding, Web Client Device ID, and IP Banning.
  1. *Token IP Binding*: Capture `player.getRemoteAddress()` at `/voice` execution; verify against WebSocket upgrade IP in `ClientGateway`.
  2. *Presence Binding*: Emit `player_quit` from Velocity's `DisconnectListener` and Paper's `PlayerQuitEvent` to disconnect orphaned sessions.
  3. *Device ID*: Client generates a UUID stored in browser `localStorage`; voice server tracks banned device IDs.
  4. *IP Banning*: Store IP alongside UUID in `punishments` table and reject matching token requests.
- **Alternatives Considered**:
  - *Browser Canvas Fingerprinting*: Overly brittle, triggers ad-blockers/privacy shields. A clean `localStorage` device UUID is robust and transparent.

### Decision 5: Speaker Block Management and Particle Feedback
- **Choice**: Manage speaker blocks via raycast commands (`/voice speaker create <id> [radius]`), persist in `speakers.yml`, and subscribe to `PlayerSpeakingStateChangeEvent` to spawn `Particle.NOTE` above the block when active.
- **Redstone**: Optional check via `Block#isBlockPowered()` or `BlockRedstoneEvent`.

## Risks / Trade-offs

- **[Risk] Shared IP False Positives (NAT / Cybercafés / Households)**: IP bans could penalize innocent roommates or family members.
  - *Mitigation*: The primary ban criteria is Player UUID + Web Client Device ID. IP checking is applied during token generation with an option in `config.yml` (`enforce-ip-ban: true|false`) so server admins can disable IP matching if hosting LAN/dormitory events.
- **[Risk] Redstone Clock Telemetry Flooding**: Rapidly pulsing redstone could trigger excessive state updates.
  - *Mitigation*: Redstone power states are sampled periodically during the existing telemetry tick cycle (10 Hz) rather than sending immediate socket frames per block event.
- **[Risk] SQLite Lock Contention**: Concurrent command execution might block the main server thread.
  - *Mitigation*: SQLite queries run asynchronously off the main Minecraft thread using Cloud command coordinators and WAL (Write-Ahead Logging) mode.

## Migration Plan

1. The plugins will automatically create `moderation.db` and `speakers.yml` with default tables upon startup.
2. Configuration files (`config.yml` in Paper and `velocity-config.yml` in Velocity) retain full backwards compatibility with existing options.
3. Rollback is safe: disabling the new modules leaves core proximity voice routing unaffected.
