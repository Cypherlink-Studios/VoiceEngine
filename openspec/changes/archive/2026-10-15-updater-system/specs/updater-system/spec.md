# Spec Delta

## Purpose

Provides automated update mechanisms for VoiceEngine, encompassing a Linux host updater script with health checks and automated rollback, a voice server health endpoint, and an in-game asynchronous Paper plugin update staging subsystem.

## ADDED Requirements

### Requirement: Host CLI Release Query and Discovery
The host updater script SHALL query the GitHub Releases API for the latest release (or a specified tag) of `Cypherlink-Studios/VoiceEngine`, extract asset download URLs for `voice-server.tar.gz`, `web-client.tar.gz`, and `checksums.sha256`, and compare the remote version against the locally installed version.

#### Scenario: Querying latest release when update is available
- **WHEN** an operator executes `scripts/update.sh` and a newer release version exists on GitHub
- **THEN** the script identifies the new version tag, displays release notes summary, and prompts for confirmation before proceeding.

#### Scenario: Checking version when local is up to date without force flag
- **WHEN** an operator runs `scripts/update.sh` and the installed version matches the remote release
- **THEN** the script outputs that VoiceEngine is already up to date and exits without performing downloads, unless `--force` is specified.

#### Scenario: Querying a specific tagged release version
- **WHEN** an operator executes `scripts/update.sh --version v1.2.0`
- **THEN** the script fetches the release metadata specifically matching tag `v1.2.0` and proceeds to download those release assets.

### Requirement: Host Pre-Update Backup and Rotation
The host updater script SHALL take an atomic snapshot of current production assets (`dist/`, `.env`, `package.json`) into a timestamped directory under `.backups/` prior to any destructive file operations, and maintain a configurable maximum number of backup snapshots.

#### Scenario: Automatic backup creation before applying update
- **WHEN** the host updater starts the installation phase
- **THEN** it copies active `voice-server/dist`, `voice-server/.env`, `voice-server/package.json`, and `web-client/dist` into `.backups/backup-<timestamp>/` before modifying any files.

#### Scenario: Backup rotation pruning old snapshots
- **WHEN** a new backup is created and the total number of snapshots in `.backups/` exceeds 3
- **THEN** the oldest backup directories are pruned to prevent disk exhaustion.

### Requirement: Release Checksum Verification and Atomic Staging
The host updater script SHALL verify downloaded asset archives against `checksums.sha256` using SHA256 before staging, and abort immediately without modifying running services if verification fails.

#### Scenario: Asset archive passes SHA256 verification
- **WHEN** downloaded archives match their entries in `checksums.sha256`
- **THEN** the script proceeds to unpack the archives and stage the files.

#### Scenario: Asset archive fails SHA256 verification
- **WHEN** an archive checksum does not match `checksums.sha256`
- **THEN** the script aborts immediately with a non-zero exit code, removes the corrupted downloads, and leaves running services untouched.

### Requirement: Production Dependency Provisioning and Config Reconciliation
The host updater script SHALL execute `npm install --omit=dev` within `voice-server` upon unpacking release files to compile or link required native worker bindings, and reconcile `.env` configurations against `.env.example` to introduce new configuration keys without overwriting existing secrets.

#### Scenario: Safe dependency installation and native binding build
- **WHEN** `voice-server.tar.gz` is unpacked into `voice-server/`
- **THEN** `npm install --omit=dev` is executed to build and link required native Mediasoup worker binaries.

#### Scenario: Non-destructive environment configuration reconciliation
- **WHEN** a new release introduces configuration keys in `.env.example` that do not exist in `voice-server/.env`
- **THEN** the updater appends the new keys with safe default values while strictly preserving all existing secret keys, IPs, and port configurations.

### Requirement: Automated Service Health Check and Immediate Rollback
The host updater script SHALL restart `voiceengine.service` upon deployment and perform active HTTP healthcheck polling against the backend health endpoint for up to 15 seconds; if the healthcheck fails or times out, it SHALL automatically roll back to the previous backup snapshot and restart the service.

#### Scenario: Successful update with healthy service verification
- **WHEN** `voiceengine.service` restarts and `GET /health` returns HTTP 200 within 15 seconds
- **THEN** the script reports a successful update, reloads Nginx, and cleans temporary staging files.

#### Scenario: Service startup failure triggers automated rollback
- **WHEN** `voiceengine.service` crashes or fails to respond to `GET /health` with HTTP 200 within 15 seconds
- **THEN** the script immediately stops the service, restores the files from the pre-update backup, restarts `voiceengine.service`, and displays error logs from systemd journal.

### Requirement: Host Updater CLI Options and Execution Modes
The host updater script SHALL support flags `--version <tag>` to target specific releases, `--force` to reinstall the current version, `--rollback` to restore the latest backup snapshot manually, `--check` to test for updates without applying, and `-y` for non-interactive execution.

#### Scenario: Manual rollback invocation
- **WHEN** an operator runs `scripts/update.sh --rollback`
- **THEN** the script restores the most recent snapshot from `.backups/`, restarts `voiceengine.service`, and verifies service health.

#### Scenario: Non-interactive update execution
- **WHEN** an operator runs `scripts/update.sh -y`
- **THEN** all user prompts are automatically confirmed using default safe behaviors.

### Requirement: Voice Server Health Inspection Endpoint
The voice server HTTP API SHALL expose a lightweight unauthenticated `GET /health` endpoint returning HTTP 200 with JSON payload containing status, uptime, current version, and SFU worker status.

#### Scenario: Healthcheck request while server is operating normally
- **WHEN** an HTTP client sends `GET /health` to the voice server port
- **THEN** the server returns HTTP 200 OK with `{"status":"ok","uptime":<seconds>,"version":"<version>","workers":<count>}`.

#### Scenario: Healthcheck request during uninitialized state
- **WHEN** the server has not completed initialization or is actively shutting down
- **THEN** `GET /health` returns HTTP 503 Service Unavailable.

### Requirement: In-Game Plugin Update Inspection and Discovery
The Paper plugin SHALL provide a `/voice update check` command restricted to `voiceengine.admin.update` that queries the GitHub Releases API asynchronously and displays update availability, current version, and target version in chat using MiniMessage.

#### Scenario: Admin checks for updates when a new version exists
- **WHEN** an administrator runs `/voice update check` in-game and a newer version exists on GitHub
- **THEN** a formatted chat message is displayed showing current and latest version with a clickable action to run `/voice update apply`.

#### Scenario: Admin checks for updates when the plugin is already on latest
- **WHEN** an administrator runs `/voice update check` in-game and the plugin is up to date
- **THEN** a message is displayed indicating VoiceEngine is already running the latest version.

### Requirement: In-Game Plugin Update Download and Staging
The Paper plugin SHALL provide a `/voice update apply` command restricted to `voiceengine.admin.update` that downloads the release JAR asynchronously, validates SHA256 if available, writes the binary to `plugins/update/VoiceEngine-paper.jar`, and notifies the administrator that changes will take effect upon server restart.

#### Scenario: Admin applies update successfully
- **WHEN** an administrator runs `/voice update apply` in-game
- **THEN** the plugin downloads the latest release JAR asynchronously without blocking the server main tick thread, saves it to `plugins/update/VoiceEngine-paper.jar`, and notifies the admin to restart the server.

#### Scenario: Download failure preserves running state without server lag
- **WHEN** network connectivity to GitHub fails during `/voice update apply`
- **THEN** an error message is sent to the administrator, no partial files are left in `plugins/update/`, and the server continues running smoothly.

### Requirement: Plugin Update Notification and Startup Checking
The Paper plugin SHALL support configurable options in `config.yml` to check for updates on startup and notify authorized administrators with an actionable chat message upon joining the server.

#### Scenario: Admin joins server when update is available
- **WHEN** a player with permission `voiceengine.admin.update` joins and `updates.notify-admins-on-join` is true and a newer version exists
- **THEN** an asynchronous notification message with an update command link is sent to that player.

#### Scenario: Non-admin joins server
- **WHEN** a player without `voiceengine.admin.update` joins
- **THEN** no update check notification is shown.
