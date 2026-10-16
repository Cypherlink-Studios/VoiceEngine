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
