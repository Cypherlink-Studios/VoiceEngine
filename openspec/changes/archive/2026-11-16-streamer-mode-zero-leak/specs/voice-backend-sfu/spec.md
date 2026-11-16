# voice-backend-sfu Spec Delta

## ADDED Requirements

### Requirement: Bidirectional Streamer Mode State Relay and Token Propagation
The voice backend SHALL propagate `streamerMode` metadata across `register_token`, `client_auth`, `auth_success`, and `/api/admin/auth`, and SHALL relay live `streamer_mode_sync` and `streamer_mode_update` frames between connected plugins and web client sessions.

#### Scenario: Token registration and auth response propagate Streamer Mode
- **WHEN** a plugin registers a token with `streamerMode` metadata (and optional `streamerModeExplicit` flag) and the web client redeems it via `client_auth`
- **THEN** the backend SHALL store `streamerMode` on the token record, resolve the initial session state (adopting `client_auth.clientStreamerMode: true` if Minecraft had no explicit preference), and include `streamerMode` in `auth_success`.

#### Scenario: First-connection web preference propagates back to plugin
- **WHEN** `client_auth` supplies `clientStreamerMode: true` for a token that had no explicit Minecraft preference (`streamerModeExplicit !== true`)
- **THEN** the backend SHALL emit a `streamer_mode_sync` frame (`enabled: true`) to the authoritative plugin socket (Velocity proxy if connected, otherwise the originating Paper `serverId` socket).

#### Scenario: Live Streamer Mode update from Minecraft plugin to web session
- **WHEN** the backend receives a `streamer_mode_sync` frame from a plugin for a player UUID with an active web client session
- **THEN** the backend SHALL immediately forward a `streamer_mode_changed` frame (`enabled`) to that player's active web client session.

#### Scenario: Live Streamer Mode update from web client to Minecraft plugin
- **WHEN** an authenticated web client sends a `streamer_mode_update` frame (`enabled`)
- **THEN** the backend SHALL update the session state and relay a `streamer_mode_sync` frame (`playerUuid`, `enabled`) to the authoritative plugin socket for persistent storage.
