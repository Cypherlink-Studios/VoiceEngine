# VoiceEngine Update & Maintenance Guide

This document describes how to update VoiceEngine across production environments, covering both the Linux host services (`voice-server` and `web-client`) and the Minecraft Paper plugin.

---

## 1. Linux Host Updates (`scripts/update.sh`)

VoiceEngine includes an automated CLI update script located in `scripts/update.sh`. It queries official releases from the GitHub repository (`Cypherlink-Studios/VoiceEngine`), verifies SHA256 checksums, creates pre-update backups, reconciles environment configurations, and executes active health checks with automated rollback.

### Quick Start

```bash
# Update host services to the latest stable release
sudo bash scripts/update.sh
```

### Command-Line Options

```bash
sudo bash scripts/update.sh [OPTIONS]

Options:
  -v, --version <tag>   Target specific release tag (e.g. -v v1.2.0). Defaults to latest.
  -f, --force           Force reinstall/update even if already on the latest version.
  -c, --check           Check for available updates without applying changes (exit 0 if available).
  -r, --rollback        Restore and activate the most recent backup snapshot from .backups/.
  -y, --yes             Run non-interactively without interactive prompts (ideal for cron).
  -h, --help            Show usage help.
```

### Safety & Automated Rollback Lifecycle

```
[1. Check Remote Version]
          │
          ▼
[2. Snapshot Current State] ──> Saves active dist/, .env, and package.json to .backups/
          │
          ▼
[3. Download & Verify SHA256] ──> Aborts cleanly if hash mismatch detected
          │
          ▼
[4. Atomic Staging] ──> Unpacks web-client/dist, updates voice-server, runs npm install --omit=dev
          │
          ▼
[5. .env Reconciliation] ──> Merges new keys from .env.example without altering secrets
          │
          ▼
[6. Systemd Restart & Healthcheck] ──> Polls http://127.0.0.1:3000/health for 15s
          │
          ├─────────────────────────────────────────┐
          │ (200 OK)                                │ (Timeout or Failure)
          ▼                                         ▼
   [Update Complete]                         [AUTO-ROLLBACK]
   Cleans temporary files                    Stops service, restores backup,
   Reloads Nginx                             restarts daemon, prints journal logs
```

### Manual Rollback

If you need to roll back to the previous deployment at any time:

```bash
sudo bash scripts/update.sh --rollback
```

Backups are stored in `.backups/backup-<timestamp>/`. The updater automatically rotates snapshots, keeping the 3 most recent backups.

---

## 2. In-Game Paper Plugin Updates (`/voice update`)

Administrators can check, preview, and stage plugin updates directly in Minecraft without leaving the game or interrupting the server.

### Permissions
* `voiceengine.admin.update`: Allows checking, downloading, and viewing changelogs (defaults to server operators).

### In-Game Commands

| Command | Description |
| :--- | :--- |
| `/voice update check` | Queries GitHub Releases API asynchronously and checks if a newer version is available. |
| `/voice update apply` | Downloads the release JAR asynchronously and stages it into `plugins/update/VoiceEngine-paper.jar`. |
| `/voice update changelog` | Displays release notes and changelog summary in chat. |

### Update Staging (`plugins/update/`)
PaperMC safely replaces plugins using the `update/` directory. When `/voice update apply` runs:
1. The new JAR is downloaded asynchronously (avoiding tick-rate drops or lag spikes).
2. The JAR is staged at `plugins/update/VoiceEngine-paper.jar`.
3. An admin notification confirms the download.
4. On the next server restart (`/restart` or reboot), Paper automatically replaces the active plugin file before classloading begins.

### Configuration (`plugins/VoiceEngine/config.yml`)

```yaml
# Automated Updates & Release Checking
updates:
  # Check for updates automatically on server startup
  check-on-startup: true
  # Notify authorized administrators in chat upon joining if an update is available
  notify-admins-on-join: true
  # GitHub repository to check for releases
  repository: "Cypherlink-Studios/VoiceEngine"
```

---

## 3. GitHub Release Packaging & CI/CD Specification

For the host updater script and Paper plugin updater to function seamlessly, GitHub Releases published to `Cypherlink-Studios/VoiceEngine` MUST include the following binary assets attached to the release:

| Release Asset Name | Description | Packaging Command |
| :--- | :--- | :--- |
| `voice-server.tar.gz` (or `voice-server-v*.tar.gz`) | Transpiled `dist/` directory and `package.json` | `tar -czf voice-server.tar.gz -C voice-server dist package.json` |
| `web-client.tar.gz` (or `web-client-v*.tar.gz`) | Production Vite bundle | `tar -czf web-client.tar.gz -C web-client/dist .` |
| `VoiceEngine-paper.jar` (or `VoiceEngine-paper-v*.jar`) | Paper plugin shadowJar binary | Built via `./gradlew shadowJar` |
| `checksums.sha256` | SHA256 checksums of all release assets | `sha256sum voice-server.tar.gz web-client.tar.gz VoiceEngine-paper.jar > checksums.sha256` |

### Sample GitHub Actions Workflow Snippet

```yaml
name: Release Packaging

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup Java 21
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      # Build Web Client
      - run: |
          cd web-client
          npm ci
          npm run build
          tar -czf ../web-client.tar.gz -C dist .

      # Build Voice Server
      - run: |
          cd voice-server
          npm ci
          npm run build
          tar -czf ../voice-server.tar.gz dist package.json

      # Build Paper Plugin
      - run: |
          cd paper-plugin
          chmod +x gradlew
          ./gradlew assemble
          cp build/libs/VoiceEngine-paper.jar ../VoiceEngine-paper.jar

      # Generate SHA256 Checksums
      - run: |
          sha256sum voice-server.tar.gz web-client.tar.gz VoiceEngine-paper.jar > checksums.sha256

      - name: Publish GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            voice-server.tar.gz
            web-client.tar.gz
            VoiceEngine-paper.jar
            checksums.sha256
```
