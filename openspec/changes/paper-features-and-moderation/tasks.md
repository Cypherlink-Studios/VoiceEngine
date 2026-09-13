## 1. Hot-Reload Architecture Fixes in Paper

- [x] 1.1 Refactor `VoiceBackendClient` lifecycle in `VoiceEnginePlugin` to perform graceful disconnection and re-handshake with updated `server-id`, `secret-key`, and URI; verify backend re-authenticates with new server ID via `/voice reload` without restarting the server.
- [x] 1.2 Update `TokenManager` to support dynamic token TTL reconfiguration upon reload and refresh `TelemetryService` scheduling; verify that newly issued tokens adopt the updated TTL.

## 2. Speaker Block System in Paper

- [x] 2.1 Implement `SpeakerManager` with `speakers.yml` persistence, recording speaker ID, world, X/Y/Z coordinates, radius, linked player UUID, and redstone requirement; verify serialization and deserialization via unit tests.
- [x] 2.2 Register administrative commands `/voice speaker create|link|unlink|remove|list|redstone` using Incendo Cloud; verify permission checks and command feedback in chat.
- [x] 2.3 Implement redstone power checking and `Particle.NOTE` particle spawning at the speaker block during active speech events (`PlayerSpeakingStateChangeEvent`); verify in-game visual particle indicators.
- [x] 2.4 Extend `SpatialTelemetryBatch` and `TelemetryCollector` to include active speaker blocks in WebSocket telemetry streams; verify serialized JSON includes the `speakers` array.

## 3. Proxy & Standalone Moderation Architecture

- [x] 3.1 Configure SQLite JDBC dependency in `velocity-plugin` (and `paper-plugin` fallback) and create `ModerationDatabase` with schema initialization, WAL mode, and async execution; verify database creation and CRUD queries.
- [x] 3.2 Implement `ModerationService` supporting mute, deafen, kick, and ban with time duration parsing (`30s`, `15m`, `2h`, `1d`, `7d`, `perm`) and expiration calculation; verify duration parsing tests.
- [x] 3.3 Register Cloud commands `/voice mute|deafen|kick|ban`, `/voice unmute|undeafen|unban`, and `/voice modstatus` in Velocity and Paper; verify command execution and permission handling.
- [x] 3.4 Integrate moderation checks into token generation: reject `/voice` requests from banned players and flag tokens from muted players with `isMuted: true`; verify banned player command rejection.

## 4. Anti-Ban Evasion Protection Layer

- [x] 4.1 Implement Token IP-Binding by capturing `player.getRemoteAddress()` at token creation, passing it in `register_token` frames, and validating against incoming WebSocket IP in `voice-server`; verify rejection with code `4003` on IP mismatch.
- [x] 4.2 Implement Minecraft Presence Binding by listening to `DisconnectEvent` in Velocity and `PlayerQuitEvent` in Paper to dispatch `player_quit` WebSocket frames; verify that leaving Minecraft immediately kicks the player's web client session.
- [x] 4.3 Add Web Client Device Fingerprinting by storing a persistent UUID in browser `localStorage`, transmitting it during `client_auth`, and verifying `voice-server` rejects connections from banned device IDs.

## 5. Voice Backend (SFU) & Web Client Integration

- [x] 5.1 Extend `SpatialEngine` in `voice-server` to ingest speaker block descriptors, compute 2D broadcast coordinates (`relX: 0, relY: 0, relZ: 0`), and prioritize broadcast over proximity; verify spatial calculation unit tests.
- [x] 5.2 Implement Mediasoup producer pausing (mute), consumer pausing (deafen), and transport termination (kick/ban) in `ClientGateway` on `moderation_action` frames; verify audio streams pause and resume appropriately.
- [x] 5.3 Update `web-client` audio pipeline to bypass 3D HRTF `PannerNode` for streams flagged with `isBroadcast: true` and render moderation notice alert banners; verify uniform stereo playback and UI banners.

## 6. Verification and Validation

- [x] 6.1 Run Gradle build and test suites for `paper-plugin` and `velocity-plugin` (`./gradlew test`); verify all Java tests pass.
- [x] 6.2 Run test suites for `voice-server` and `web-client` (`npm test` / `npm run build`); verify TypeScript compilation and tests pass.
- [x] 6.3 Run `openspec validate` on `paper-features-and-moderation`; verify strict specification compliance.
