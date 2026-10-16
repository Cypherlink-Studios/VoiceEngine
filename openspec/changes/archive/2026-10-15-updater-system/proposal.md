# Proposal: VoiceEngine Updater System

## Why

Operating VoiceEngine in production currently requires manual SSH access, git pulling, rebuilding from source, and manually swapping JAR files on Minecraft game servers whenever a new release is published. This manual process causes extended downtime, consumes high CPU/RAM on game servers during local compilation, and increases the risk of human error or deployment failure without an automated rollback mechanism.

An automated updater system for both the Linux host and the Paper Minecraft plugin using official precompiled GitHub Releases provides fast, atomic, safe, and verifiable upgrades with automatic health checks and rollback.

## What Changes

- **Host CLI Updater (`scripts/update.sh`)**:
  - Adds a dedicated management script to query GitHub Releases (`Cypherlink-Studios/VoiceEngine`), download precompiled assets (`voice-server.tar.gz`, `web-client.tar.gz`), verify SHA256 checksums, and perform atomic directory replacements.
  - Adds automatic pre-update backups of active `dist/`, `.env`, and dependencies into `.backups/` with rotation.
  - Installs production dependencies via `npm install --omit=dev` to safely build/link native worker binaries (Mediasoup).
  - Automatically reconciles `.env` configurations from `.env.example` without overwriting production secrets.
  - Executes post-restart health checking against a dedicated `/health` endpoint on `voice-server` with automated instant rollback if the service fails to boot or pass validation.
  - Supports CLI flags: `--version <tag>`, `--force`, `--rollback`, `--check`, and `-y`/`--yes`.

- **Voice Server Health Endpoint**:
  - Adds `GET /health` on `voice-server` providing lightweight, unauthenticated status check returning service uptime, version, and SFU worker status for monitoring and updater verification.

- **Paper Plugin In-Game Updater (`/voice update`)**:
  - Adds `/voice update` command hierarchy with subcommands `check`, `apply`, and `changelog` guarded by `voiceengine.admin.update` permission.
  - Executes all GitHub API requests and JAR binary downloads asynchronously without blocking the Minecraft main server tick loop.
  - Stages verified plugin JARs directly into `plugins/update/VoiceEngine-paper.jar` for safe, corruption-free replacement upon the next server restart.
  - Adds optional automatic update checking upon server startup and admin join notifications configured in `config.yml`.

## Capabilities

### New Capabilities
- `updater-system`: Provides end-to-end automated update mechanisms for VoiceEngine, encompassing the Linux host updater script with healthcheck/rollback, the voice server health inspection endpoint, and the Paper Minecraft in-game async plugin update subsystem.

### Modified Capabilities
*(None; existing specs remain intact without requirement alterations)*

## Impact

- **Affected Code**:
  - `scripts/update.sh`: New host updater script.
  - `voice-server/src/index.ts` / `voice-server/src/routes/api.ts`: Addition of `GET /health` endpoint.
  - `paper-plugin`: New `UpdateService`, `UpdateChecker`, `UpdateDownloader`, and `VoiceUpdateCommand` under `com.voiceengine.update` and `com.voiceengine.command`.
  - `paper-plugin/src/main/resources/config.yml` and `plugin.yml`: Addition of `updates` configuration block and `voiceengine.admin.update` permission.
- **APIs & Dependencies**:
  - Integration with GitHub Releases API (`https://api.github.com/repos/Cypherlink-Studios/VoiceEngine/releases`).
  - No new heavy dependencies; utilizes existing `express` on backend and Java `HttpClient` on Paper plugin.
