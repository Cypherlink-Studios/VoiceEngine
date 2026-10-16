#!/usr/bin/env bash
# ==============================================================================
# VoiceEngine - Automated Host Updater Script
# ==============================================================================
# Supports: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
# ==============================================================================

set -euo pipefail

# ANSI color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# ------------------------------------------------------------------------------
# Default Variables and Path Discovery
# ------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GITHUB_REPO="${VOICEENGINE_REPO:-Cypherlink-Studios/VoiceEngine}"
BACKUP_BASE_DIR="${REPO_DIR}/.backups"
MAX_BACKUPS=3

TARGET_VERSION=""
FORCE_UPDATE=false
CHECK_ONLY=false
DO_ROLLBACK=false
NON_INTERACTIVE=false

# ------------------------------------------------------------------------------
# Help & Usage
# ------------------------------------------------------------------------------
show_help() {
    cat <<EOF
VoiceEngine Host Updater Script

Usage:
  sudo bash scripts/update.sh [OPTIONS]

Options:
  -v, --version <tag>   Target specific release tag (e.g. v1.2.0). Defaults to latest.
  -f, --force           Force reinstall/update even if already on the latest version.
  -c, --check           Check for available updates without applying any changes.
  -r, --rollback        Restore and activate the most recent backup from .backups/.
  -y, --yes             Run non-interactively without interactive prompts.
  -h, --help            Show this help message.

Environment Variables:
  VOICEENGINE_REPO      GitHub repository to fetch releases from (default: Cypherlink-Studios/VoiceEngine).
EOF
}

# ------------------------------------------------------------------------------
# Parse Command-Line Arguments
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_UPDATE=true
            shift
            ;;
        -c|--check)
            CHECK_ONLY=true
            shift
            ;;
        -r|--rollback)
            DO_ROLLBACK=true
            shift
            ;;
        -y|--yes)
            NON_INTERACTIVE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# ------------------------------------------------------------------------------
# Helper: Get Local Version
# ------------------------------------------------------------------------------
get_local_version() {
    local pkg_file="${REPO_DIR}/voice-server/package.json"
    if [ -f "$pkg_file" ]; then
        if command -v jq >/dev/null 2>&1; then
            jq -r '.version // "unknown"' "$pkg_file"
        else
            grep -m 1 '"version"' "$pkg_file" | sed -E 's/.*"version": "([^"]+)".*/\1/'
        fi
    else
        echo "unknown"
    fi
}

# ------------------------------------------------------------------------------
# Check Only Mode
# ------------------------------------------------------------------------------
if [ "$CHECK_ONLY" = true ]; then
    log_info "Checking for VoiceEngine updates from GitHub (${GITHUB_REPO})..."
    API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
    RELEASE_DATA=$(curl -sSL -H "Accept: application/vnd.github.v3+json" "$API_URL" || true)

    if [ -z "$RELEASE_DATA" ] || echo "$RELEASE_DATA" | grep -q '"message": "Not Found"'; then
        log_error "Could not retrieve release information from ${GITHUB_REPO}."
        exit 1
    fi

    LATEST_TAG=$(echo "$RELEASE_DATA" | jq -r '.tag_name // empty' 2>/dev/null || grep -m 1 '"tag_name"' <<< "$RELEASE_DATA" | sed -E 's/.*"tag_name": "([^"]+)".*/\1/')
    LOCAL_VER=$(get_local_version)

    echo ""
    echo -e "${BOLD}VoiceEngine Version Status:${NC}"
    echo -e "  Installed Version: ${CYAN}${LOCAL_VER}${NC}"
    echo -e "  Latest Release:    ${GREEN}${LATEST_TAG:-unknown}${NC}"
    echo ""

    CLEAN_LOCAL="${LOCAL_VER#v}"
    CLEAN_LATEST="${LATEST_TAG#v}"

    if [ -n "$LATEST_TAG" ] && [ "$CLEAN_LOCAL" != "$CLEAN_LATEST" ]; then
        log_success "An update is available: ${LOCAL_VER} -> ${LATEST_TAG}"
        exit 0
    else
        log_info "VoiceEngine is already running the latest version."
        exit 0
    fi
fi

# ------------------------------------------------------------------------------
# Privilege & Prerequisite Verification (For Update & Rollback)
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root or with sudo privileges (e.g.: sudo bash scripts/update.sh)"
    exit 1
fi

for tool in curl jq tar systemctl node npm; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        log_error "Required dependency '$tool' is not installed or not in PATH."
        exit 1
    fi
done

# ------------------------------------------------------------------------------
# Rollback Functionality
# ------------------------------------------------------------------------------
perform_rollback() {
    local target_backup="$1"

    if [ ! -d "$target_backup" ]; then
        log_error "Backup directory not found: $target_backup"
        exit 1
    fi

    log_warn "Starting rollback using backup: ${target_backup}..."

    log_info "Stopping voiceengine service..."
    systemctl stop voiceengine || true

    if [ -d "${target_backup}/voice-server-dist" ]; then
        log_info "Restoring voice-server/dist..."
        rm -rf "${REPO_DIR}/voice-server/dist"
        cp -r "${target_backup}/voice-server-dist" "${REPO_DIR}/voice-server/dist"
    fi

    if [ -f "${target_backup}/voice-server-env" ]; then
        log_info "Restoring voice-server/.env..."
        cp "${target_backup}/voice-server-env" "${REPO_DIR}/voice-server/.env"
    fi

    if [ -f "${target_backup}/voice-server-package.json" ]; then
        log_info "Restoring voice-server/package.json..."
        cp "${target_backup}/voice-server-package.json" "${REPO_DIR}/voice-server/package.json"
    fi

    if [ -d "${target_backup}/web-client-dist" ]; then
        log_info "Restoring web-client/dist..."
        rm -rf "${REPO_DIR}/web-client/dist"
        cp -r "${target_backup}/web-client-dist" "${REPO_DIR}/web-client/dist"
    fi

    log_info "Re-starting voiceengine service..."
    systemctl start voiceengine

    # Quick health check after rollback
    log_info "Verifying service status after rollback..."
    sleep 2
    if systemctl is-active --quiet voiceengine; then
        log_success "Rollback successfully completed! Service is running."
    else
        log_error "Service failed to start after rollback. Check journalctl -u voiceengine."
        exit 1
    fi
}

if [ "$DO_ROLLBACK" = true ]; then
    if [ ! -d "$BACKUP_BASE_DIR" ]; then
        log_error "No backups directory found at ${BACKUP_BASE_DIR}."
        exit 1
    fi

    LATEST_BACKUP=$(find "$BACKUP_BASE_DIR" -mindepth 1 -maxdepth 1 -type d -name "backup-*" | sort -r | head -n 1)
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No previous backup snapshots found in ${BACKUP_BASE_DIR}."
        exit 1
    fi

    perform_rollback "$LATEST_BACKUP"
    exit 0
fi

# ------------------------------------------------------------------------------
# Query GitHub Release Data
# ------------------------------------------------------------------------------
if [ -n "$TARGET_VERSION" ]; then
    log_info "Resolving target release tag '${TARGET_VERSION}' from ${GITHUB_REPO}..."
    API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${TARGET_VERSION}"
else
    log_info "Resolving latest stable release from ${GITHUB_REPO}..."
    API_URL="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
fi

RELEASE_DATA=$(curl -sSL -H "Accept: application/vnd.github.v3+json" "$API_URL" || true)

if [ -z "$RELEASE_DATA" ] || echo "$RELEASE_DATA" | grep -q '"message": "Not Found"'; then
    log_error "Unable to locate release on GitHub. Verify repository name (${GITHUB_REPO}) and target tag."
    exit 1
fi

RELEASE_TAG=$(echo "$RELEASE_DATA" | jq -r '.tag_name // empty')
RELEASE_NAME=$(echo "$RELEASE_DATA" | jq -r '.name // empty')
LOCAL_VER=$(get_local_version)

echo ""
echo -e "${BLUE}=====================================================${NC}"
echo -e "${BOLD}         VoiceEngine Host Updater Wizard             ${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "• Installed Version: ${CYAN}${LOCAL_VER}${NC}"
echo -e "• Target Release:    ${GREEN}${RELEASE_TAG} (${RELEASE_NAME})${NC}"
echo ""

CLEAN_LOCAL="${LOCAL_VER#v}"
CLEAN_REMOTE="${RELEASE_TAG#v}"

if [ "$FORCE_UPDATE" = false ] && [ "$CLEAN_LOCAL" = "$CLEAN_REMOTE" ] && [ "$LOCAL_VER" != "unknown" ]; then
    log_success "VoiceEngine is already at version ${RELEASE_TAG}. Nothing to update."
    echo -e "Use ${BOLD}--force${NC} if you wish to reinstall this version."
    exit 0
fi

if [ "$NON_INTERACTIVE" = false ] && [ -t 0 ]; then
    read -rp "Do you wish to proceed with updating VoiceEngine to ${RELEASE_TAG}? [y/N]: " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[yYsS]$ ]]; then
        log_info "Update canceled by operator."
        exit 0
    fi
fi

# ------------------------------------------------------------------------------
# Extract Asset Download URLs
# ------------------------------------------------------------------------------
VOICE_SERVER_URL=$(echo "$RELEASE_DATA" | jq -r '.assets[] | select(.name | test("voice-server.*\\.tar\\.gz$")) | .browser_download_url' | head -n 1)
WEB_CLIENT_URL=$(echo "$RELEASE_DATA" | jq -r '.assets[] | select(.name | test("web-client.*\\.tar\\.gz$")) | .browser_download_url' | head -n 1)
CHECKSUM_URL=$(echo "$RELEASE_DATA" | jq -r '.assets[] | select(.name == "checksums.sha256" or .name == "checksums.txt") | .browser_download_url' | head -n 1)

if [ -z "$VOICE_SERVER_URL" ] || [ -z "$WEB_CLIENT_URL" ]; then
    log_error "Release ${RELEASE_TAG} does not contain required assets (voice-server and web-client archives)."
    exit 1
fi

# ------------------------------------------------------------------------------
# Snapshot & Backup Current State
# ------------------------------------------------------------------------------
mkdir -p "$BACKUP_BASE_DIR"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_BACKUP="${BACKUP_BASE_DIR}/backup-${BACKUP_TIMESTAMP}"

log_info "Creating pre-update backup at ${CURRENT_BACKUP}..."
mkdir -p "$CURRENT_BACKUP"

if [ -d "${REPO_DIR}/voice-server/dist" ]; then
    cp -r "${REPO_DIR}/voice-server/dist" "${CURRENT_BACKUP}/voice-server-dist"
fi

if [ -f "${REPO_DIR}/voice-server/.env" ]; then
    cp "${REPO_DIR}/voice-server/.env" "${CURRENT_BACKUP}/voice-server-env"
fi

if [ -f "${REPO_DIR}/voice-server/package.json" ]; then
    cp "${REPO_DIR}/voice-server/package.json" "${CURRENT_BACKUP}/voice-server-package.json"
fi

if [ -d "${REPO_DIR}/web-client/dist" ]; then
    cp -r "${REPO_DIR}/web-client/dist" "${CURRENT_BACKUP}/web-client-dist"
fi

log_success "Backup completed."

# Backup rotation: Keep at most MAX_BACKUPS snapshots
BACKUP_COUNT=$(find "$BACKUP_BASE_DIR" -mindepth 1 -maxdepth 1 -type d -name "backup-*" | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    log_info "Pruning old backups (keeping latest ${MAX_BACKUPS})..."
    find "$BACKUP_BASE_DIR" -mindepth 1 -maxdepth 1 -type d -name "backup-*" | sort | head -n -"$MAX_BACKUPS" | xargs rm -rf
fi

# ------------------------------------------------------------------------------
# Download & Checksum Verification
# ------------------------------------------------------------------------------
TMP_DIR=$(mktemp -d /tmp/voiceengine-update-XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

log_info "Downloading release assets to temporary staging directory..."
curl -sSL "$VOICE_SERVER_URL" -o "${TMP_DIR}/voice-server.tar.gz"
curl -sSL "$WEB_CLIENT_URL" -o "${TMP_DIR}/web-client.tar.gz"

if [ -n "$CHECKSUM_URL" ]; then
    log_info "Downloading SHA256 checksums..."
    curl -sSL "$CHECKSUM_URL" -o "${TMP_DIR}/checksums.sha256"

    log_info "Verifying downloaded archive checksums..."
    cd "$TMP_DIR"
    if ! sha256sum --check --ignore-missing checksums.sha256; then
        log_error "SHA256 checksum verification failed! Aborting update to prevent file corruption."
        exit 1
    fi
    log_success "SHA256 checksum verification passed."
fi

# ------------------------------------------------------------------------------
# Atomic File Replacement and Extraction
# ------------------------------------------------------------------------------
log_info "Updating Web Client files (web-client/dist)..."
mkdir -p "${REPO_DIR}/web-client/dist"
tar -xzf "${TMP_DIR}/web-client.tar.gz" -C "${REPO_DIR}/web-client/dist" --strip-components=1 2>/dev/null || tar -xzf "${TMP_DIR}/web-client.tar.gz" -C "${REPO_DIR}/web-client"
log_success "Web client updated."

log_info "Stopping voiceengine service for backend upgrade..."
systemctl stop voiceengine || true

log_info "Extracting Voice Server update (voice-server)..."
mkdir -p "${REPO_DIR}/voice-server/dist"
tar -xzf "${TMP_DIR}/voice-server.tar.gz" -C "${REPO_DIR}/voice-server"
log_success "Voice server files unpacked."

log_info "Installing and verifying production dependencies (npm install --omit=dev)..."
cd "${REPO_DIR}/voice-server"
if ! npm install --omit=dev; then
    log_error "Failed to install dependencies or build native modules. Initiating automatic rollback..."
    perform_rollback "$CURRENT_BACKUP"
    exit 1
fi
log_success "Dependencies verified."

# ------------------------------------------------------------------------------
# Non-destructive .env Reconciliation
# ------------------------------------------------------------------------------
ENV_FILE="${REPO_DIR}/voice-server/.env"
ENV_EXAMPLE="${REPO_DIR}/voice-server/.env.example"

if [ -f "$ENV_EXAMPLE" ] && [ -f "$ENV_FILE" ]; then
    log_info "Reconciling environment variables with .env.example..."
    while IFS='=' read -r key val || [ -n "$key" ]; do
        # Ignore comments and blank lines
        key=$(echo "$key" | tr -d ' ' | sed 's/#.*//')
        if [ -n "$key" ]; then
            if ! grep -q "^${key}=" "$ENV_FILE"; then
                log_warn "Appending new configuration setting '${key}' from .env.example with default value."
                grep "^${key}=" "$ENV_EXAMPLE" >> "$ENV_FILE" || true
            fi
        fi
    done < "$ENV_EXAMPLE"
    log_success "Environment configuration reconciled."
fi

# ------------------------------------------------------------------------------
# Service Restart & Active Health Check
# ------------------------------------------------------------------------------
log_info "Starting voiceengine service..."
systemctl start voiceengine

PORT=3000
if [ -f "$ENV_FILE" ]; then
    CONFIG_PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' "\r' || true)
    if [ -n "$CONFIG_PORT" ]; then
        PORT="$CONFIG_PORT"
    fi
fi

log_info "Performing healthcheck on http://127.0.0.1:${PORT}/health..."
HEALTHY=false
for i in {1..15}; do
    if curl -s -f "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 1
done

if [ "$HEALTHY" = true ]; then
    log_success "Healthcheck succeeded! VoiceEngine backend is active and responding."
    if systemctl is-active --quiet nginx; then
        systemctl reload nginx || true
        log_info "Nginx reloaded."
    fi

    echo ""
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${GREEN}      VoiceEngine Update Completed Successfully!     ${NC}"
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "• Updated to Version: ${RELEASE_TAG}"
    echo -e "• Service Status:     Active (systemctl status voiceengine)"
    echo -e "• Backup Retained:    ${CURRENT_BACKUP}"
    echo ""
    exit 0
else
    log_error "Healthcheck failed! Service did not respond within 15 seconds."
    log_warn "Initiating automated rollback to previous working version..."
    perform_rollback "$CURRENT_BACKUP"
    echo ""
    log_info "Displaying recent systemd journal logs:"
    journalctl -u voiceengine -n 25 --no-pager || true
    exit 1
fi
