# Design

## Context

`paper-plugin` currently implements an asynchronous GitHub Releases updater (`com.voiceengine.update`) with `/voice update check|apply|changelog`, startup checks, and admin join notifications. However:
1. `velocity-plugin` has no updater subsystem yet, even though `.github/workflows/release.yml` already publishes `VoiceEngine-velocity.jar` and `checksums.sha256` on every GitHub Release.
2. Velocity does not have Paper's built-in `plugins/update/` auto-apply mechanism on restart.
3. Because `AGENTS.md` enforces independent SemVer per component (`paper-plugin` at `1.3.0`, `velocity-plugin` at `1.1.1`) while GitHub Releases share a single tag (`v1.3.0`), comparing only `pluginVersion` against `tag_name` produces false-positive update alerts whenever another component is bumped.

## Goals / Non-Goals

**Goals:**
- Provide feature-parity in-game/console update commands (`/voice-velocity update check|apply|changelog`), startup check, and admin join notifications in `velocity-plugin`.
- Eliminate cross-component false-positive update alerts in both `velocity-plugin` and `paper-plugin` by comparing the running JAR's SHA-256 against `checksums.sha256` when available.
- Verify downloaded JAR integrity against `checksums.sha256` before staging in both plugins.
- Safely stage and apply `VoiceEngine-velocity.jar` on `ProxyShutdownEvent` without risking lazy-classloading corruption while running.

**Non-Goals:**
- Implementing a full `TranslationService` (`messages_*.yml`) in `velocity-plugin` (it currently uses MiniMessage strings directly).
- Hot-reloading the plugin JAR at runtime without a proxy restart.
- Modifying `.github/workflows/release.yml` (it already produces `VoiceEngine-velocity.jar`, `VoiceEngine-paper.jar`, and `checksums.sha256`).

## Decisions

### 1. Staging in `plugins/update/` + Replacement on `ProxyShutdownEvent`
- **Decision**: `UpdateDownloader` downloads `VoiceEngine-velocity.jar.tmp` into `<plugins>/update/`, verifies SHA-256, atomically renames to `<plugins>/update/VoiceEngine-velocity.jar`, and records a pending staged `Path` in memory. During `ProxyShutdownEvent`, `VoiceEngineVelocityPlugin` replaces the running JAR (resolved via `ProtectionDomain.getCodeSource().getLocation()`).
- **Rationale**: Replacing the active JAR while the proxy is running risks `ZipException` / `NoClassDefFoundError` on lazy classloading. Deferring replacement to `ProxyShutdownEvent` mirrors Paper's restart UX on Linux/macOS.
- **Alternative considered**: Direct in-place replacement at download time (rejected due to lazy classloading risk and Windows file locks) or manual-only staging (rejected because Linux/macOS proxies can automate it safely on shutdown).

### 2. Running-JAR SHA-256 Comparison Against `checksums.sha256`
- **Decision**: When `UpdateChecker` detects `isNewerVersion(currentVersion, tagName) == true` and `checksums.sha256` is present in the release assets, it fetches `checksums.sha256`, parses the SHA-256 for the component's JAR (`VoiceEngine-velocity.jar` or `VoiceEngine-paper.jar`), and compares it to the SHA-256 of the running JAR file (if resolvable via `CodeSource` and readable as a regular file). If they match, `updateAvailable` is set to `false`.
- **Rationale**: Prevents false-positive notifications when a release tag is bumped for another component (e.g., `voice-server` or `web-client`), while gracefully falling back to SemVer-only comparison in unit tests or when `checksums.sha256` is absent.
- **Alternative considered**: Embedding per-component version metadata in GitHub Release bodies (fragile and couples CI/release notes).

### 3. Download Integrity Verification via `checksums.sha256`
- **Decision**: `UpdateDownloader` accepts an optional expected SHA-256 (or `checksums.sha256` URL) and validates the `.tmp` file's SHA-256 before moving it to the final staged path in both `velocity-plugin` and `paper-plugin`.
- **Rationale**: Satisfies `updater-system` integrity requirements and protects against truncated or corrupted downloads.

### 4. Velocity Command Naming & Permissions
- **Decision**: Register `/voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity update <check|apply|changelog>` under permission `voiceengine.admin.update`.
- **Rationale**: Matches `VelocityVoiceCommands` naming conventions to avoid command collisions with `paper-plugin`'s `/voice` on proxied networks.

## Risks / Trade-offs

- **Windows JAR File Lock on Shutdown** → On Windows, the JVM locks open JARs until process exit, causing `Files.move`/`Files.copy` during `ProxyShutdownEvent` to throw `AccessDeniedException`/`FileSystemException`. Mitigation: catch `IOException` during shutdown replacement, keep `plugins/update/VoiceEngine-velocity.jar` intact, and log a clear warning with source and target paths for manual replacement.
- **Extra HTTP Request for `checksums.sha256`** → Checking `checksums.sha256` adds one small text fetch only when `isNewerVersion` is true. Mitigation: results remain cached for 1 hour (`CACHE_DURATION`), and network errors fetching `checksums.sha256` fall back gracefully rather than failing the update check.
- **Non-file `CodeSource` (e.g., unit tests or custom classloaders)** → If the running JAR path cannot be resolved as a regular file, local SHA-256 calculation returns `Optional.empty()` and falls back to SemVer comparison.
