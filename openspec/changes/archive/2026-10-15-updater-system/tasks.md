# Tasks: VoiceEngine Updater System

## 1. Voice Server Health Endpoint

- [x] 1.1 Implement unauthenticated `GET /health` in `voice-server/src/index.ts` returning status, uptime, version from package.json, and active SFU worker count. Verify with `npm test` in `voice-server`.
- [x] 1.2 Add unit and route tests in `voice-server/test/health.test.ts` covering healthy status response and verify tests pass with `npm test`.

## 2. Linux Host CLI Updater Script

- [x] 2.1 Create `scripts/update.sh` with CLI flag parsing (`--version`, `--force`, `--rollback`, `--check`, `-y`), root EUID verification, and GitHub Releases API query against `Cypherlink-Studios/VoiceEngine`. Verify with `--help` and `--check`.
- [x] 2.2 Implement backup snapshotting of active `dist/`, `.env`, and `package.json` to `.backups/backup-<timestamp>/` with rotation to retain at most 3 backups. Verify backup creation and pruning logic.
- [x] 2.3 Implement download, SHA256 verification against `checksums.sha256`, asset staging, and production dependency build via `npm install --omit=dev`. Verify checksum validation aborts on hash mismatch.
- [x] 2.4 Implement `.env` non-destructive reconciliation from `.env.example`, systemd service restart, 15-second active HTTP polling against `/health`, and automated instant rollback on failure. Verify rollback triggers when health check fails.

## 3. Minecraft Paper Plugin Update Subsystem

- [x] 3.1 Add `updates` configuration block (`check-on-startup`, `notify-admins-on-join`, `repository`) to `paper-plugin/src/main/resources/config.yml` and update `VoiceConfig.java` to parse it. Verify with unit tests.
- [x] 3.2 Implement `UpdateChecker` and `UpdateDownloader` under `com.voiceengine.update` using asynchronous Java `HttpClient` to query GitHub Releases API, compare semantic versions, and stage JAR files into `plugins/update/VoiceEngine-paper.jar`. Verify with mock HTTP tests.
- [x] 3.3 Register permission `voiceengine.admin.update` in `plugin.yml` and implement `/voice update` Cloud command with `check`, `apply`, and `changelog` subcommands in `VoiceUpdateCommand.java`. Verify command syntax and permissions in test suite.
- [x] 3.4 Add translation keys for update notifications, progress, and prompts in `paper-plugin/src/main/resources/messages/` (`messages_en.properties` and `messages_es.properties`). Verify locale bundle loading.
- [x] 3.5 Implement player join listener for notifying admins when an update is available if enabled in configuration, and verify Paper plugin tests with `./gradlew test`.

## 4. Documentation & Release Packaging

- [x] 4.1 Document host updater operations, command-line flags, and in-game `/voice update` procedures in `docs/installation/DEPLOY.md` and `docs/installation/UPDATING.md`. Verify documentation links and markdown formatting.
- [x] 4.2 Document GitHub Release asset packaging requirements (`voice-server.tar.gz`, `web-client.tar.gz`, `VoiceEngine-paper.jar`, `checksums.sha256`) for CI/CD workflows.
