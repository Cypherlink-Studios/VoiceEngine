# Design

## Context

See `proposal.md` for motivation and background.

Currently, `paper-plugin` streams spatial telemetry batches (`telemetry_batch`) carrying `serverId` and `radarEnabled: boolean`. When received by `voice-server`, `PluginGateway.ts` updates `SpatialEngine.setServerRadarEnabled(batchServerId, message.radarEnabled)`. However, `/voice` connection tokens are generated via `register_token` frames that omit `serverId`. Consequently, `TokenStore` and `ClientSession` do not retain the player's server context.

When a browser client connects (`client_auth`), `ClientGateway.ts` immediately invokes `SpatialEngine.isRadarEnabledForPlayer(session.playerUuid)`. If spatial telemetry has not yet indexed the player in `SpatialEngine.players`, `player?.serverId` evaluates to `undefined`. `isRadarEnabledForServer(undefined)` queries `serverRadarStatus.get('default')`, which is undefined on custom servers (e.g. `survival`), and evaluates to `true` via `?? true`.

## Goals / Non-Goals

**Goals:**
- Guarantee that `ClientGateway` knows the player's originating `serverId` immediately upon `client_auth`.
- Eliminate the initial race condition where unindexed players default to `radar_status: true` on servers with custom IDs.
- Ensure `SpatialEngine` gracefully resolves server radar policy even when `serverId` is undefined or `'default'`, adapting to single-server environments.
- Maintain full backwards compatibility for legacy plugins or tools registering tokens without an explicit `serverId`.

**Non-Goals:**
- Modifying web-client radar rendering components (`<Radar />`, `<ProximityRoster />`, or `<PipOverlay />`).
- Modifying WebRTC media routing, Opus transcoding, or spatial audio deadband suppression algorithms.
- Changing `config.yml` schema structure or property naming.

## Decisions

### Decision 1: Threading `serverId` through the Token Lifecycle
- **Choice**: Add `serverId` to the `register_token` payload in `VoiceBackendClient.java`, store it in `SessionTokenRecord` in `TokenStore.ts`, and transfer it to `ClientSession` in `ClientGateway.ts`.
- **Alternatives Considered**:
  - *Infer serverId from IP or username*: Fragile, breaks on multi-server proxy setups and NAT environments.
  - *Wait for telemetry before completing client_auth*: Introduces connection latency and blocks WebRTC transport creation.
- **Rationale**: Directly associating the token with its origin server provides instant, authoritative server context upon client connection.

### Decision 2: Dual Fallback in `SpatialEngine` Radar Evaluation
- **Choice**:
  1. Update `isRadarEnabledForPlayer(playerUuid: string, sessionServerId?: string): boolean` to check `this.players.get(playerUuid)?.serverId` first, then fall back to `sessionServerId`.
  2. In `isRadarEnabledForServer(serverId: string | undefined): boolean`:
     - If `serverId` is provided and exists in `serverRadarStatus`, return its status.
     - If `serverId` is undefined or `'default'` and does NOT exist in `serverRadarStatus`, check if `serverRadarStatus.size === 1`. If so, return that single server's status. Otherwise, return `true`.
- **Alternatives Considered**:
  - *Require `'default'` entry always*: If a server is configured with `server-id: survival`, forcing a default entry requires arbitrary guessing or duplicating maps.
- **Rationale**: Ensures single-server deployments with custom names resolve correctly even if a query lacks an explicit serverId.

### Decision 3: Socket Metadata Fallback in `PluginGateway`
- **Choice**: In `PluginGateway.ts`'s `register_token` handler, set `serverId: message.serverId || meta?.serverId || 'default'`.
- **Rationale**: Protects against any plugin caller that might omit `serverId`, extracting it directly from the authenticated socket handshake metadata.

## Risks / Trade-offs

- **[Risk: Multi-server proxy hopping before telemetry update]**
  *Mitigation*: When a player switches servers on a proxy network, `startProximityLoop` continuously checks `isRadarEnabledForPlayer` every 100ms. Once telemetry updates the player's `serverId` in `SpatialEngine`, the loop immediately detects the status divergence and dispatches a dynamic `radar_status` update frame.

- **[Risk: Legacy token registrations without serverId]**
  *Mitigation*: Fallback chain (`message.serverId` -> `meta?.serverId` -> `serverRadarStatus` single entry -> `'default'`) guarantees complete backward compatibility without breaking existing tests or deployments.

## Migration Plan

1. Update `paper-plugin` (`VoiceBackendClient.java`) to send `serverId` in `register_token`.
2. Update `voice-server` backend (`types.ts`, `TokenStore.ts`, `PluginGateway.ts`, `ClientGateway.ts`, `SpatialEngine.ts`).
3. Run existing and new test suites across `voice-server` and `paper-plugin` to verify end-to-end functionality.
