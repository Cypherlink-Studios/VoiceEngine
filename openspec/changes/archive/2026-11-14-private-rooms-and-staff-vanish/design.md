# Design

## Context

VoiceEngine coordinates audio between Minecraft game servers (`paper-plugin`), an SFU media routing backend (`voice-server` with Mediasoup and `SpatialEngine`), and a browser client (`web-client`). Currently, the system supports 3D spatialized proximity chat and static fixed channels loaded from `settings.json`. Telemetry flows from Paper to the backend via WebSocket batches, while browser clients receive relative coordinates or stereo channel audio.

See `proposal.md` for the motivation and feature overview.

## Goals / Non-Goals

**Goals:**
- Provide ephemeral, in-memory private rooms identified by a 6-digit numeric PIN with seamless in-game and web-client parity.
- Guarantee strict stereo unspatialized audio routing between room members with complete proximity isolation.
- Enforce anti-brute-force rate limiting (maximum 5 failed attempts per minute per IP/player).
- Deliver a zero-leak staff vanish mode that guarantees no WebRTC consumer creation, no spatial coordinates, no web radar presence, and no in-game particles for regular players.
- Enable mutual 3D proximity and radar visibility between vanished staff members.
- Enable administrative wiretapping (`/voice room spy <playerName>`) without exposing room PINs or alerting room occupants.

**Non-Goals:**
- Persistent database storage for temporary rooms (they are strictly ephemeral and discarded when empty).
- Password protection or invite whitelists beyond 6-digit PINs.
- Cross-cluster room routing outside the connected `PluginGateway` and SFU network.

## Decisions

### 1. Centralized In-Memory Room Management in `voice-server`
- **Choice**: Implement a dedicated `RoomManager` module inside `voice-server` that owns room states, PIN generation, membership sets, rate limits, and destruction timers.
- **Rationale**: Both `web-client` connections (via `ClientGateway`) and in-game commands (via `PluginGateway`) converge at `voice-server`. Centralizing room state avoids distributed state desynchronization across Paper servers and the proxy.
- **Alternatives Considered**: Managing rooms in Paper (requires multi-server RPC to sync with web clients and proxies) or Redis (unnecessary operational complexity for ephemeral rooms).

### 2. Zero-Leak Consumer Suppression at SFU Routing Layer
- **Choice**: When evaluating consumers in `ClientGateway` and `SpatialEngine`, if a speaker has `isStaffVanish: true`, no Mediasoup consumer is created on any non-staff listener's transport.
- **Rationale**: Server-side muting with an active WebRTC consumer would still expose track IDs and bandwidth metrics in `chrome://webrtc-internals` and DevTools. Never creating the consumer ensures cryptographic and protocol-level invisibility.
- **Alternatives Considered**: Creating consumers with paused state or muted gain (fails the strict zero-leak audit).

### 3. Mutual Staff-to-Staff Awareness Matrix
- **Choice**: Vanished staff members are evaluated as audible peers only for listeners who also possess `isStaff: true` or active vanish mode.
- **Rationale**: Staff need to collaborate and communicate in the field during moderation patrols without breaking cover from regular players.
- **Alternatives Considered**: Total isolation (staff cannot hear each other, leading to confusion during joint moderation).

### 4. Player-Bound Room Wiretap (`/voice room spy <playerName>`)
- **Choice**: Staff join the room occupied by a specified player without needing to lookup or supply the 6-digit PIN. The staff member's session is marked with `isRoomSpy: true`, muting their microphone towards the room and suppressing their entry from the room's public member roster.
- **Rationale**: When responding to player reports, staff know the player's name, not their secret room code. This provides frictionless moderation while preserving stealth.
- **Alternatives Considered**: Requiring staff to query an active room list first (adds extra command steps).

### 5. PIN Space and Anti-Brute-Force Rate Limiting
- **Choice**: Rooms use a 6-digit numeric string (`100000` to `999999`, 900,000 space). Failed submissions are tracked per IP and player UUID using a sliding 60-second window. Reaching 5 failures triggers a 60-second lockout.
- **Rationale**: 6 digits are simple for players to read, remember, and type, while the rate limiter renders brute-force enumeration mathematically infeasible.
- **Alternatives Considered**: Alphanumeric codes (harder to type on mobile/gamepads) or unlimited attempts (vulnerable to dictionary scanning).

## Risks / Trade-offs

- **[PIN Collision Risk]** → `RoomManager` checks for existing active codes in a set before assigning a newly generated PIN, retrying up to 10 times.
- **[Ghost/Abandoned Rooms]** → When the last member disconnects or leaves, a 30-second grace timer begins. If no one joins, the room is deleted and its PIN returned to the pool.
- **[Accidental Staff Mic Leak]** → Staff audio is strictly gated at the router level by listener role; even if a staff member speaks with an open microphone, regular players have no consumer to receive the audio.
- **[In-Game Particle Indicator Leak]** → Paper's `SpeechFeedbackHandler` checks a thread-safe set of vanished player UUIDs before scheduling particle spawn tasks, suppressing visual speech feedback entirely for vanished staff.
- **[Owner Departure]** → If the room owner leaves or disconnects, ownership is automatically transferred to the next oldest active member in the room.

## Migration Plan

- **Backward Compatibility**: Existing fixed channels, proximity 3D audio, and moderation bans/mutes continue operating without disruption.
- **Configuration**: Paper's `config.yml` adds default entries:
  ```yaml
  rooms:
    max-members: 0        # 0 or negative = unlimited
  vanish:
    auto-hook: true       # Listen for EssentialsX / SuperVanish / PlayerHideEvent
  ```
- **Rollback Strategy**: If room routing issues occur, players can revert to proximity chat immediately via `/voice room leave` or web-client UI toggle.
