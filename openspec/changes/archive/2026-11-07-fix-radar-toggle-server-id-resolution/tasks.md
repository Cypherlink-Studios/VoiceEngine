# Tasks

## 1. Paper Plugin Token Dispatch

- [x] 1.1 Update `VoiceBackendClient.java` to serialize `serverId` in `register_token` frames, and verify compilation via `./gradlew.bat testClasses`
- [x] 1.2 Write unit tests in `paper-plugin/src/test/java/com/voiceengine/net/` verifying `register_token` JSON serialization includes `serverId`, and execute via `./gradlew.bat test`

## 2. Voice Server Token & Session Tracking

- [x] 2.1 Update `types.ts` to include optional `serverId?: string` in `SessionTokenRecord` and `ClientSession`, and verify TypeScript compilation
- [x] 2.2 Update `TokenStore.ts` to store `serverId` on registered tokens, and verify existing dev tokens default to `'default'`
- [x] 2.3 Update `PluginGateway.ts` to pass `message.serverId || meta?.serverId || 'default'` during `register_token` handling
- [x] 2.4 Update `ClientGateway.ts` `client_auth` handler to assign `session.serverId = tokenRecord.serverId`
- [x] 2.5 Add unit tests in `voice-server/test/TokenStore.test.ts` and `voice-server/test/PluginGateway.test.ts` validating token serverId preservation and run `npm --prefix voice-server test`

## 3. Spatial Engine Server Resolution & Radar Dispatch

- [x] 3.1 Update `SpatialEngine.ts` to support `isRadarEnabledForPlayer(playerUuid: string, sessionServerId?: string)` with session fallback and single-server resolution in `isRadarEnabledForServer(serverId)`
- [x] 3.2 Update `ClientGateway.ts` initial `client_auth` and `startProximityLoop` to pass `session.serverId` when evaluating radar status
- [x] 3.3 Add unit tests in `voice-server/test/SpatialEngine.test.ts` and `voice-server/test/ClientGateway.test.ts` covering custom serverId resolution before telemetry indexing, and run `npm --prefix voice-server test`

## 4. End-to-End Integration Verification

- [x] 4.1 Add an end-to-end integration test in `voice-server/test/IntegrationHarness.test.ts` for a custom server ID with `radarEnabled: false` where the client connects prior to spatial indexing, verifying initial `radar_status: false`
- [x] 4.2 Run complete regression test suite across `paper-plugin` (`./gradlew.bat test`) and `voice-server` (`npm --prefix voice-server test`) to ensure 100% test pass rate
