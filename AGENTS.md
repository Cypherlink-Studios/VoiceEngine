# VoiceEngine — Agent Instructions

## Component Versioning Policy (SemVer)

VoiceEngine uses **Semantic Versioning (`MAJOR.MINOR.PATCH`)** independently per component. All four components—including `velocity-plugin`—follow pure `MAJOR.MINOR.PATCH` SemVer (no `-SNAPSHOT` suffix on releases).

### Mandatory Condition for Version Bumps
A component's version string MUST be updated **if and only if** that component was updated during the active session:
1. **Updated in active session** -> Bump that component's SemVer string according to change scope:
   - `MAJOR`: Breaking changes (protocol, public API, config schema, or incompatible behavior).
   - `MINOR`: Backward-compatible new features or capabilities.
   - `PATCH`: Backward-compatible bug fixes, refactors, or internal improvements.
2. **NOT updated in active session** -> **Do NOT modify** its version string.

Never perform blind repo-wide version bumps across unmodified components.

---

## Component Version Reference

| Component | Primary Version File(s) | Secondary / Synced File(s) | Notes |
| :--- | :--- | :--- | :--- |
| `paper-plugin` | `paper-plugin/build.gradle.kts` (`version = "..."`, line 7) | `paper-plugin/src/main/resources/plugin.yml` (`version: ${version}`) | Gradle `processResources` injects `project.version` into `plugin.yml`. Do not hardcode a version in `plugin.yml`. |
| `velocity-plugin` | `velocity-plugin/build.gradle.kts` (`version = "..."`, line 7) | `velocity-plugin/src/main/java/com/voiceengine/velocity/VoiceEngineVelocityPlugin.java` (`@Plugin(..., version = "...")`, line 29) | **Both files MUST be updated to the exact same pure SemVer (`MAJOR.MINOR.PATCH`) string** (Gradle does not auto-expand `@Plugin`). |
| `voice-server` | `voice-server/package.json` (`"version"`) | `voice-server/package-lock.json` (root `"version"` and `packages[""].version`) | `src/index.ts` reads `package.json` dynamically at runtime for `GET /health`. Run `npm version <ver> --no-git-tag-version` in `voice-server/` or update both files together. |
| `web-client` | `web-client/package.json` (`"version"`) | `web-client/package-lock.json` (root `"version"` and `packages[""].version`) | Run `npm version <ver> --no-git-tag-version` in `web-client/` or update both files together. |

### Out of Scope for Per-Component Bumps
- `docs/metadata.yml`: Managed separately via the release/documentation workflow (`plugin-docs-versioning`), not on every individual component edit.
- Test fixtures and historical docs/specs: Do not alter mock/example version strings in unit tests or archived OpenSpec documents.
