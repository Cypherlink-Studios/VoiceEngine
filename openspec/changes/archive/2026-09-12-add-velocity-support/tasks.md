# Implementation Tasks: Velocity Proxy Support and Multi-Backend Network Voice Chat

## 1. Voice Server: Multi-Backend Gateway and Spatial Isolation

- [x] 1.1 Update `types.ts` to include `serverId?: string` in `PlayerSpatialState`, add `scope?: 'global' | 'server'` to `FixedChannelConfig`, and verify TypeScript compilation with `npm run build` in `voice-server`.
- [x] 1.2 Update `SpatialEngine.ts` to record `serverId` and enforce `speaker.serverId === listener.serverId && speaker.world === listener.world` during proximity evaluation; add unit tests in `SpatialEngine.test.ts` and verify with `npm test`.
- [x] 1.3 Refactor `PluginGateway.ts` to manage multiple Paper backend sockets identified by `serverId` and a dedicated Velocity socket; update handshake handling and route `speech_status` to the player's active server; verify with `PluginGateway.test.ts`.
- [x] 1.4 Update `ClientGateway.ts` fixed channel routing to respect `channel.scope` (`global` across all network sessions vs `server` matching the listener's `serverId`); verify with unit tests.

## 2. Web Client: Channel Scope Customization

- [x] 2.1 Update channel types in `BrandProvider.tsx` to include `scope?: 'global' | 'server'`, defaulting new channels to `'global'`.
- [x] 2.2 Add channel scope selector (Global vs Per-Server) in `ChannelsTab.tsx` and verify that created channels persist with the chosen scope via `npm run build` in `web-client`.

## 3. Paper Plugin: Server ID and Proxy Mode

- [x] 3.1 Update `VoiceConfig.java` to parse `server-id` (defaulting to `"default"`) and `proxy-mode` (`auto`, `true`, `false`) from `config.yml`.
- [x] 3.2 Update `PlayerSpatialState.java` and `SpatialTelemetryBatch.java` to serialize `serverId` in telemetry payloads; verify with Gradle test in `paper-plugin`.
- [x] 3.3 Update `VoiceEnginePlugin.java` to detect proxy mode (or modern forwarding), suppress local `/voice` command registration and join notifications when `proxy-mode` is active, and verify with `./gradlew :paper-plugin:test`.

## 4. Velocity Plugin: Dedicated Proxy Module

- [x] 4.1 Scaffold `velocity-plugin/` directory with `build.gradle.kts`, Velocity API 3.4+, Incendo Cloud Velocity 2.0, Java-WebSocket, and include it in root Gradle settings.
- [x] 4.2 Implement `VelocityVoiceConfig` and default `velocity-config.yml` loading for voice server URI, secret key, and join notifications.
- [x] 4.3 Implement `VelocityBackendClient` for authenticated WebSocket communication with `voice-server`, supporting token registration frames and resilient backoff reconnection.
- [x] 4.4 Implement `/voice` command hierarchy (`/voice`, `/voice admin`, `/voice reload`) in `VelocityVoiceCommands.java` using Incendo Cloud Velocity, and verify token generation and clickable URL dispatch.
- [x] 4.5 Implement `ServerPostConnectListener` to deliver network welcome notifications on initial join and track player transitions between backend servers.
- [x] 4.6 Build fat shadow JAR (`VoiceEngine-velocity.jar`) and verify build execution with `./gradlew :velocity-plugin:build`.

## 5. Verification and Network Integration

- [x] 5.1 Run full automated test suites across `voice-server`, `paper-plugin`, and `velocity-plugin` to verify regression-free builds.
- [x] 5.2 Validate OpenSpec compliance using `openspec validate add-velocity-support --strict`.
