# Proposal

## Why

When a Paper server defines a custom `server-id` (e.g. `server-id: "survival"`) and disables the proximity radar via `mechanics.radar-enabled: false`, the web client fails to deactivate the circular radar soundstage and does not switch to `<ProximityRoster />`. This happens because token registration (`register_token`) omits the server identifier, leaving client sessions detached from their originating server's radar configuration. When `client_auth` queries the player's radar policy before telemetry indexes them in the spatial grid, `SpatialEngine` looks up `'default'`, which does not exist in `serverRadarStatus`, and defaults to `true`.

## What Changes

- **Paper Plugin Token Dispatch**: Include `serverId` within the `register_token` WebSocket payload sent by `VoiceBackendClient.java` to the voice backend SFU.
- **Backend Token Store & Session Context**: Update `SessionTokenRecord` and `ClientSession` in `voice-server` to persist `serverId`. Ensure `PluginGateway` records `serverId` on tokens (falling back to plugin socket metadata if omitted).
- **Spatial Engine Server Resolution**:
  - Update `isRadarEnabledForPlayer(playerUuid, sessionServerId?)` to check the spatial index first, then fall back to the session's known `serverId`.
  - Update `isRadarEnabledForServer(serverId)` so that if `serverId` is undefined or `'default'` and does not exist in `serverRadarStatus`, it falls back to the sole connected server if only one server is registered, preventing an unwarranted fallback to `true`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `paper-voice-bridge`: Update token generation and dispatch requirements to ensure token registration packages include the originating server identifier alongside player metadata.
- `voice-backend-sfu`: Update plugin control and token verification requirements to persist `serverId` on session token records and client sessions, and ensure spatial proximity radar evaluation accurately resolves server radar policy across custom server IDs.

## Impact

- **Paper Plugin**: `VoiceBackendClient.java` sends `serverId` in `register_token`.
- **Voice Server Backend**:
  - `TokenStore.ts`: `registerToken` and `SessionTokenRecord` accept and store `serverId`.
  - `PluginGateway.ts`: Passes `message.serverId || meta?.serverId` when registering tokens.
  - `ClientGateway.ts`: Stores `serverId` on `ClientSession`, passes session `serverId` when evaluating initial and loop radar status.
  - `SpatialEngine.ts`: Resolves radar status with session fallback and single-server fallback logic.
  - `types.ts`: Updates `SessionTokenRecord` and `ClientSession` interfaces.
- **Web Client**: No client protocol or UI component changes needed; the client already listens for `radar_status` and swaps to `<ProximityRoster />`.
- **Compatibility**: Fully backwards-compatible. Older plugins omitting `serverId` will fall back to socket metadata or `'default'`.
