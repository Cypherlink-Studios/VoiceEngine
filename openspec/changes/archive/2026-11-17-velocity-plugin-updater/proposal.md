# Proposal

## Why

VoiceEngine currently provides an in-game GitHub Releases updater only for `paper-plugin` (alongside the Linux host updater script), leaving `velocity-plugin` without automated update discovery, staging, or admin notifications even though CI already publishes `VoiceEngine-velocity.jar` and `checksums.sha256` on every release. Additionally, because VoiceEngine versions each component independently via SemVer, a GitHub Release tag bumped for another component can cause false-positive update alerts unless the running plugin JAR is also compared against `checksums.sha256`.

## What Changes

- Add an asynchronous GitHub Releases updater subsystem to `velocity-plugin` (`UpdateChecker`, `UpdateDownloader`, `ReleaseInfo`, `ReleaseCheckResult`), mirroring `paper-plugin` and adapting JAR replacement for Velocity's lifecycle.
- Add `/voice-velocity update check|apply|changelog` commands (and existing aliases `ve-velocity`, `voiceengine-velocity`, `audio-velocity`) guarded by `voiceengine.admin.update`.
- Add `updates` configuration options (`check-on-startup`, `notify-admins-on-join`, `repository`) to `velocity-config.yml` and `VelocityVoiceConfig`, plus startup update checking and admin join notifications on `ServerPostConnectEvent`.
- Stage `VoiceEngine-velocity.jar` in `plugins/update/` and apply the replacement automatically during `ProxyShutdownEvent` (with a clear fallback warning if the OS locks the running JAR, e.g., on Windows).
- Add SHA-256 comparison of the running plugin JAR against `checksums.sha256` during update checks (to prevent cross-component false positives) and SHA-256 integrity verification of downloaded JARs in both `velocity-plugin` and `paper-plugin`.

## Capabilities

### New Capabilities

_(None — all requirements extend the existing `updater-system` capability.)_

### Modified Capabilities

- `updater-system`: Extend in-game plugin update inspection, download/staging, and startup/join notifications to `velocity-plugin`, and require SHA-256 running-JAR comparison and download integrity verification against `checksums.sha256` for both `paper-plugin` and `velocity-plugin`.

## Impact

- **`velocity-plugin`**: New `com.voiceengine.velocity.update` package, `VelocityUpdateCommands`, updates to `VoiceEngineVelocityPlugin`, `VelocityVoiceConfig`, `ServerPostConnectListener`, `velocity-config.yml`, and new unit tests.
- **`paper-plugin`**: Updates to `UpdateChecker`, `UpdateDownloader`, `VoiceEnginePlugin`, `VoiceUpdateCommand`, and existing unit tests (`UpdateCheckerTest`) to support running-JAR SHA-256 comparison and download checksum verification.
- **No breaking changes** to existing commands, permissions, or `velocity-config.yml` / `config.yml` schemas (new `updates` keys in `velocity-config.yml` default safely when absent).
