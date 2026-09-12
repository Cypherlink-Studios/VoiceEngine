# Proposal: Enhance Velocity Plugin Hot-Reload and Command Aliases

## Why

Currently, reloading the Velocity proxy plugin via `/voice reload` only re-reads configuration from disk and re-establishes WebSocket connectivity if `voice-server-url` changes. If an administrator rotates `secret-key` or modifies `token-ttl-minutes`, the changes are either ignored by the active backend client or delayed until a full proxy restart. Additionally, administrators and players frequently expect command aliases such as `/ve` and `/voiceengine`.

## What Changes

- **Credential Rotation Reconnection**: Detect modifications to `secret-key` (in addition to `voice-server-url`) during `/voice reload`, cleanly reconnecting the backend client with updated authentication headers and handshake frames.
- **Dynamic Token TTL Updates**: Enable `VelocityTokenManager` to dynamically update its session token time-to-live upon reload so that subsequent session tokens inherit the new duration immediately.
- **Root Command Aliases**: Register `/ve`, `/voiceengine`, and `/audio` command aliases alongside `/voice` across all subcommands (`connect`, `admin`, `reload`, and `status`).

## Capabilities

### Modified Capabilities

- `velocity-voice-proxy`: Update command dispatch to support `/ve`, `/voiceengine`, and `/audio` aliases, and enhance reload behavior to hot-apply secret key updates and dynamic token TTLs.

## Impact

- `velocity-plugin`:
  - `VelocityBackendClient.java`: Expose `secretKey` via getter to enable change detection.
  - `VelocityTokenManager.java`: Add `setTokenTtl(Duration)` for dynamic lifecycle adjustments.
  - `VelocityVoiceCommands.java`: Update `@Command` annotations to `voice|ve|voiceengine|audio`.
  - `VoiceEngineVelocityPlugin.java`: Update `reloadPlugin()` to check secretKey and set token TTL.
