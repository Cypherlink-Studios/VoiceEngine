# Design: VoiceEngine Updater System

## Context

VoiceEngine is deployed across Linux hosts (`voice-server` Node.js daemon and `web-client` SPA) and Minecraft game servers (`paper-plugin`). Previously, updates required manual git operations, source builds, and manual file copying. See [proposal.md](file:///C:/Users/antua/OneDrive/Documentos/Programming/MISC/VoiceEngine/openspec/changes/updater-system/proposal.md) for background and motivation.

## Goals / Non-Goals

**Goals:**
- Provide a robust Linux host CLI script (`scripts/update.sh`) that automates downloading precompiled release archives from GitHub, verifying SHA256 hashes, taking atomic backups, executing production dependency builds, and auto-rolling back if the service fails health checks.
- Provide an in-game `/voice update` command suite on Paper Minecraft servers that checks for new releases asynchronously and stages verified JARs in `plugins/update/` without server lag or classloader corruption.
- Provide a dedicated, unauthenticated `GET /health` endpoint on `voice-server` for health check polling and external monitoring.

**Non-Goals:**
- Building from source on target production hosts during standard update execution (builds are produced upstream in GitHub Actions CI/CD).
- Hot class reloading of the Paper plugin JAR inside a running JVM (Paper requires a restart to swap the JAR safely from `plugins/update/`).
- Managing external system packages (OS packages like OpenJDK and Node.js remain managed by `install.sh` or system package managers).

## Decisions

### Decision 1: Distribution via GitHub Releases with Lightweight Backend Tarballs
- **Choice**: Publish `voice-server.tar.gz` (containing compiled `dist/` and `package.json`), `web-client.tar.gz` (compiled Vite SPA bundle), `VoiceEngine-paper.jar`, and `checksums.sha256` under `Cypherlink-Studios/VoiceEngine`. The host updater unpacks `voice-server` and runs `npm install --omit=dev`.
- **Rationale**: Keeps release archive sizes small (~2-5 MB instead of 50+ MB) while ensuring that Mediasoup native C++ worker binaries (`mediasoup-worker`) are properly compiled/linked for the host machine's specific glibc and kernel version.
- **Alternatives Considered**:
  - *Full source compilation (`git pull`)*: High CPU/RAM consumption during updates, requires full dev dependencies (TypeScript, Vite, Gradle).
  - *Fat binary / bundled node_modules*: Large releases and high risk of binary incompatibilities across different Linux distributions and CPU architectures.

### Decision 2: Staging Paper Plugin Updates via `plugins/update/`
- **Choice**: The `/voice update apply` command downloads the verified JAR to `plugins/update/VoiceEngine-paper.jar`.
- **Rationale**: PaperMC and Bukkit have built-in support for the `update/` directory. On server shutdown/restart, Paper safely replaces the running JAR before classloader initialization, eliminating `ClassNotFoundException`, file locks on Windows, or state corruption.
- **Alternatives Considered**:
  - *Hot JAR overwrite*: Causes classloader errors when loaded classes access new resources or unloaded classes.
  - *Custom plugin loader / reflection reload*: Unstable across different Paper versions (1.20 - 1.21.4).

### Decision 3: Dedicated `/health` Endpoint for Verifiable Service Readiness
- **Choice**: Introduce `GET /health` on `voice-server` returning JSON status (status, uptime, version, worker count) with HTTP 200 when ready, and HTTP 503 during startup or shutdown.
- **Rationale**: Allows the host updater script to perform reliable HTTP polling for up to 15 seconds to verify that Mediasoup workers spawned, WebRTC sockets bound, and the HTTP server is serving requests before finalizing the update.
- **Alternatives Considered**:
  - *`systemctl is-active` only*: Reports active as soon as Node starts, even if Mediasoup fails to initialize workers or the port fails to bind.
  - *Scraping `/metrics`*: Excessive payload parsing for a binary pass/fail readiness test.

### Decision 4: Automated Snapshotting, Health Checking, and Instant Rollback
- **Choice**: Before extracting any files, `scripts/update.sh` archives active `dist/` folders and `.env` into `.backups/backup-<timestamp>/`. If `systemctl start voiceengine` fails or `/health` does not respond with HTTP 200 within 15 seconds, the script automatically restores the snapshot, restarts the service, and prints journal logs.
- **Rationale**: Guarantees zero unattended breakage: if a release has a fatal configuration or binary issue, the server automatically recovers to the previous working version with minimal downtime (<10 seconds).
- **Alternatives Considered**:
  - *Manual rollback only*: Leaves production offline if an update is run without immediate interactive oversight.

## Risks / Trade-offs

- **[GitHub API Rate Limiting]** → Unauthenticated requests to GitHub API are limited to 60 requests/hour per IP.
  - *Mitigation*: The Paper plugin caches update check results for 1 hour, and the host script queries GitHub only on explicit invocation.
- **[Native Worker Compilation Delay]** → `npm install --omit=dev` may take 5-15 seconds if Mediasoup requires local worker recompilation.
  - *Mitigation*: The script runs `npm install` before stopping the systemd service whenever possible, or keeps downtime confined to the restart and test window.
- **[Corrupted Downloads]** → Network interruptions during tarball download could result in broken files.
  - *Mitigation*: The updater downloads to `/tmp/`, validates SHA256 checksums, and only proceeds to unpack if the hash matches.
- **[Configuration Drift]** → New features may require new environment variables.
  - *Mitigation*: The script compares `.env.example` with `.env` and appends missing variables with safe commented defaults without touching existing secrets.
