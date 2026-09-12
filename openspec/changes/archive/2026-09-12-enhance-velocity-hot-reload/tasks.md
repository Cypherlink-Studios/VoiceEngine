# Implementation Tasks: Enhance Velocity Hot-Reload and Command Aliases

## 1. Velocity Core Enhancements

- [x] 1.1 Expose `getSecretKey()` in `VelocityBackendClient.java` and update `VoiceEngineVelocityPlugin.java#reloadPlugin` to reconnect if either URI or secretKey changes.
- [x] 1.2 Update `VelocityTokenManager.java` with a volatile `tokenTtl` field and `setTokenTtl(Duration)` method; invoke it from `reloadPlugin()`.
- [x] 1.3 Add unit test in `VelocityTokenManagerTest.java` verifying that tokens generated after `setTokenTtl(...)` reflect the updated expiration duration.
- [x] 1.4 Update `@Command` annotations in `VelocityVoiceCommands.java` to support root command aliases (`voice|ve|voiceengine`) across `connect`, `admin`, `reload`, and `status`.
- [x] 1.5 Register `/audio` as an alias for the `/voice` command hierarchy (`/audio`, `/audio admin`, `/audio reload`, `/audio status`) in `VelocityVoiceCommands.java` and verify command routing.

## 2. Verification and Integration

- [x] 2.1 Run `./gradlew :velocity-plugin:test` and `./gradlew :velocity-plugin:build` to verify test passes and shadow JAR packaging.
- [x] 2.2 Validate OpenSpec compliance using `openspec validate enhance-velocity-hot-reload --strict`.
