# Spec Delta

## MODIFIED Requirements

### Requirement: In-Game Plugin Update Inspection and Discovery
The Paper plugin SHALL provide a `/voice update check` command restricted to `voiceengine.admin.update` that queries the GitHub Releases API asynchronously, compares the remote release version and `checksums.sha256` entry for `VoiceEngine-paper.jar` against the running plugin version and JAR SHA-256 hash when available, and displays update availability, current version, and target version in chat using MiniMessage.

#### Scenario: Admin checks for updates when a new version exists
- **WHEN** an administrator runs `/voice update check` in-game and a newer release version exists on GitHub whose `VoiceEngine-paper.jar` checksum differs from the running JAR (or no checksum is available)
- **THEN** a formatted chat message is displayed showing current and latest version with a clickable action to run `/voice update apply`.

#### Scenario: Admin checks for updates when the plugin is already on latest
- **WHEN** an administrator runs `/voice update check` in-game and the plugin is up to date
- **THEN** a message is displayed indicating VoiceEngine is already running the latest version.

#### Scenario: Remote release tag is newer but Paper JAR checksum matches running JAR
- **WHEN** an administrator runs `/voice update check` in-game and the latest GitHub release tag is higher than the Paper plugin version, but `checksums.sha256` lists a SHA-256 for `VoiceEngine-paper.jar` that matches the running JAR
- **THEN** the plugin reports that VoiceEngine is already running the latest build and does not flag a false-positive update.

### Requirement: In-Game Plugin Update Download and Staging
The Paper plugin SHALL provide a `/voice update apply` command restricted to `voiceengine.admin.update` that downloads the release JAR asynchronously, verifies its SHA-256 hash against `checksums.sha256` when available, writes the binary to `plugins/update/VoiceEngine-paper.jar`, and notifies the administrator that changes will take effect upon server restart.

#### Scenario: Admin applies update successfully
- **WHEN** an administrator runs `/voice update apply` in-game and the downloaded JAR passes SHA-256 verification (or no checksum asset is published)
- **THEN** the plugin saves the verified JAR to `plugins/update/VoiceEngine-paper.jar` without blocking the server main tick thread and notifies the admin to restart the server.

#### Scenario: Downloaded JAR fails SHA-256 verification
- **WHEN** an administrator runs `/voice update apply` and the downloaded JAR's SHA-256 hash does not match the `VoiceEngine-paper.jar` entry in `checksums.sha256`
- **THEN** the plugin aborts staging, deletes any temporary download file, leaves `plugins/update/VoiceEngine-paper.jar` untouched, and notifies the administrator of the checksum mismatch.

#### Scenario: Download failure preserves running state without server lag
- **WHEN** network connectivity to GitHub fails during `/voice update apply`
- **THEN** an error message is sent to the administrator, no partial files are left in `plugins/update/`, and the server continues running smoothly.

## ADDED Requirements

### Requirement: Velocity Plugin Update Inspection and Discovery
The Velocity plugin SHALL provide `/voice-velocity update check` and `/voice-velocity update changelog` commands (and their `ve-velocity`, `voiceengine-velocity`, `audio-velocity` aliases) restricted to `voiceengine.admin.update` that query the GitHub Releases API asynchronously, compare the remote release version and `checksums.sha256` entry for `VoiceEngine-velocity.jar` against the running plugin version and JAR SHA-256 hash when available, and display results in chat using MiniMessage.

#### Scenario: Proxy admin checks for updates when a new Velocity build exists
- **WHEN** an administrator runs `/voice-velocity update check` and a newer GitHub release exists whose `VoiceEngine-velocity.jar` SHA-256 differs from the running JAR (or no checksum is available)
- **THEN** a formatted MiniMessage response is sent showing current and latest versions with a clickable action to run `/voice-velocity update apply`.

#### Scenario: Remote release tag is newer but Velocity JAR checksum matches running JAR
- **WHEN** an administrator runs `/voice-velocity update check` and the latest GitHub release tag is higher than the Velocity plugin version, but `checksums.sha256` lists a SHA-256 for `VoiceEngine-velocity.jar` that matches the running JAR
- **THEN** the plugin reports that VoiceEngine-Velocity is already up to date.

#### Scenario: Proxy admin views release changelog
- **WHEN** an administrator runs `/voice-velocity update changelog`
- **THEN** the plugin asynchronously fetches or reads cached release notes, truncates overly long notes for chat readability, and displays them to the sender.

### Requirement: Velocity Plugin Update Download, Verification, and Shutdown Replacement
The Velocity plugin SHALL provide a `/voice-velocity update apply` command restricted to `voiceengine.admin.update` that downloads `VoiceEngine-velocity.jar` asynchronously, verifies its SHA-256 hash against `checksums.sha256` when available, stages it in `plugins/update/VoiceEngine-velocity.jar`, and attempts to replace the running plugin JAR during proxy shutdown.

#### Scenario: Proxy admin stages a verified update
- **WHEN** an administrator runs `/voice-velocity update apply` and the downloaded JAR passes SHA-256 verification (or no checksum asset is published)
- **THEN** the plugin stages the binary at `plugins/update/VoiceEngine-velocity.jar` and notifies the administrator to restart the Velocity proxy to complete the update.

#### Scenario: Downloaded Velocity JAR fails SHA-256 verification
- **WHEN** an administrator runs `/voice-velocity update apply` and the downloaded JAR's SHA-256 hash does not match the `VoiceEngine-velocity.jar` entry in `checksums.sha256`
- **THEN** the plugin aborts staging, deletes any temporary file, and sends a checksum verification failure message to the administrator.

#### Scenario: Proxy shuts down with a staged update on a non-locking filesystem
- **WHEN** Velocity fires `ProxyShutdownEvent` with a staged `plugins/update/VoiceEngine-velocity.jar` pending and the OS permits replacing the running JAR file
- **THEN** the plugin replaces the running plugin JAR with the staged JAR and removes the staged file.

#### Scenario: Proxy shuts down when the OS locks the running JAR
- **WHEN** Velocity fires `ProxyShutdownEvent` with a staged `plugins/update/VoiceEngine-velocity.jar` pending and the OS denies overwriting the running JAR (e.g., Windows file lock)
- **THEN** the plugin logs a warning containing the staged file path (`plugins/update/VoiceEngine-velocity.jar`) and target JAR path so the operator can replace it manually before starting the proxy.

### Requirement: Velocity Plugin Update Notification and Startup Checking
The Velocity plugin SHALL support `updates.check-on-startup`, `updates.notify-admins-on-join`, and `updates.repository` in `velocity-config.yml` to check for updates asynchronously on proxy startup and notify authorized administrators when they first connect to the proxy network.

#### Scenario: Admin connects to proxy when update is available
- **WHEN** a player with permission `voiceengine.admin.update` completes their initial proxy connection (`ServerPostConnectEvent` with no previous server), `updates.notify-admins-on-join` is `true`, and a cached update is available
- **THEN** an asynchronous notification message with a clickable `/voice-velocity update apply` action is sent to that player.

#### Scenario: Non-admin connects to proxy
- **WHEN** a player without `voiceengine.admin.update` connects to the proxy
- **THEN** no update notification is sent.
