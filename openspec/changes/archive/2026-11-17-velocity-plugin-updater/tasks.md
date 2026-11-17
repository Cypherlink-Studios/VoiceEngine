# Tasks

## 1. Velocity Update Core & SHA-256 Verification

- [x] 1.1 Create `ReleaseInfo`, `ReleaseCheckResult`, and `UpdateChecker` in `velocity-plugin/src/main/java/com/voiceengine/velocity/update/` supporting GitHub Releases API queries (1h cache), `VoiceEngine-velocity*.jar` + `checksums.sha256` asset discovery, and running-JAR SHA-256 comparison against `checksums.sha256`, verified by unit tests in `UpdateCheckerTest` (`./gradlew test`).
- [x] 1.2 Create `UpdateDownloader` in `velocity-plugin/src/main/java/com/voiceengine/velocity/update/` that streams `VoiceEngine-velocity.jar.tmp` into `plugins/update/`, verifies its SHA-256 against `checksums.sha256` when available (deleting `.tmp` on mismatch), and atomically moves it to `plugins/update/VoiceEngine-velocity.jar`, verified by unit tests in `UpdateDownloaderTest` (`./gradlew test`).

## 2. Velocity Configuration, Commands & Lifecycle Integration

- [x] 2.1 Add `updates.check-on-startup`, `updates.notify-admins-on-join`, and `updates.repository` to `velocity-plugin/src/main/resources/velocity-config.yml` and `VelocityVoiceConfig.java` (with safe defaults for existing configs), and verify with `VelocityVoiceConfigTest` (`./gradlew test`).
- [x] 2.2 Create `VelocityUpdateCommands.java` registering `/voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity update <check|apply|changelog>` under `voiceengine.admin.update` with MiniMessage responses and clickable actions, and register it in `VoiceEngineVelocityPlugin.java`.
- [x] 2.3 Wire startup update check and `ProxyShutdownEvent` JAR replacement (replacing the running `CodeSource` JAR with the staged `plugins/update/VoiceEngine-velocity.jar` and logging a clear warning if OS file locking prevents replacement) in `VoiceEngineVelocityPlugin.java`, plus delayed admin join notification (`voiceengine.admin.update`) in `ServerPostConnectListener.java`; verify `velocity-plugin` builds cleanly (`./gradlew test assemble`).

## 3. Paper Plugin SHA-256 Parity

- [x] 3.1 Update `paper-plugin`'s `UpdateChecker.java` (and `ReleaseInfo.java` if needed) to fetch `checksums.sha256` when a newer tag is detected and compare the `VoiceEngine-paper.jar` hash against the running JAR's SHA-256 to prevent cross-component false positives, verified by unit tests in `paper-plugin/.../UpdateCheckerTest.java` (`./gradlew test`).
- [x] 3.2 Update `paper-plugin`'s `UpdateDownloader.java` (and `VoiceUpdateCommand.java` call site) to verify the downloaded `.tmp` JAR against the expected SHA-256 from `checksums.sha256` before staging into `plugins/update/VoiceEngine-paper.jar`, verified by unit tests (`./gradlew test`).

## 4. Versioning & Final Verification

- [x] 4.1 Bump `velocity-plugin` (`1.1.1` -> `1.2.0` in `velocity-plugin/build.gradle.kts` and `VoiceEngineVelocityPlugin.java`) and `paper-plugin` (`1.3.0` -> `1.3.1` in `paper-plugin/build.gradle.kts`) per `AGENTS.md` SemVer policy, and verify full test and assembly builds pass in both `velocity-plugin` and `paper-plugin` (`./gradlew test assemble`).
