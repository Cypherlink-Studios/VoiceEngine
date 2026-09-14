#!/usr/bin/env bash
# ==============================================================================
# VoiceEngine - Audio Tools Installer (FFmpeg & yt-dlp)
# ==============================================================================
# Installs and configures external audio processing dependencies (FFmpeg, yt-dlp)
# required for media streaming, YouTube audio extraction, and audio emitter features.
# Supported: Ubuntu 20.04+, Debian 11+, and compatible Linux distributions.
# ==============================================================================

set -euo pipefail

# ANSI color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
# 1. Privileges Verification
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root or with sudo privileges:"
    echo "  sudo bash scripts/install_audio_tools.sh"
    exit 1
fi

echo -e "${CYAN}=====================================================${NC}"
echo -e "${CYAN}     VoiceEngine - Audio Tools Installer             ${NC}"
echo -e "${CYAN}=====================================================${NC}"
log_info "Starting installation of audio dependencies (FFmpeg & yt-dlp)..."

# ------------------------------------------------------------------------------
# 2. Package Lists & Pre-requisites (curl, ca-certificates)
# ------------------------------------------------------------------------------
log_info "Updating system package repositories..."
if ! apt-get update -y; then
    log_warn "apt-get update encountered warnings or non-critical errors. Proceeding..."
fi

log_info "Ensuring base download utilities (curl, wget, ca-certificates) are present..."
apt-get install -y curl wget ca-certificates python3

# ------------------------------------------------------------------------------
# 3. Install FFmpeg & FFprobe
# ------------------------------------------------------------------------------
log_info "Checking FFmpeg..."
if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG_VER=$(ffmpeg -version 2>&1 | head -n1)
    log_success "FFmpeg is already installed: ${FFMPEG_VER}"
else
    log_info "Installing FFmpeg and audio codecs via apt-get..."
    apt-get install -y ffmpeg
    if command -v ffmpeg >/dev/null 2>&1; then
        FFMPEG_VER=$(ffmpeg -version 2>&1 | head -n1)
        log_success "FFmpeg installed successfully: ${FFMPEG_VER}"
    else
        log_error "Failed to install FFmpeg via apt-get."
        exit 1
    fi
fi

# ------------------------------------------------------------------------------
# 4. Install / Update yt-dlp
# ------------------------------------------------------------------------------
log_info "Checking yt-dlp..."
YTDLP_TARGET="/usr/local/bin/yt-dlp"
INSTALLED_YTDLP=false

# If already present, attempt self-update or verify
if command -v yt-dlp >/dev/null 2>&1; then
    CURRENT_BIN=$(command -v yt-dlp)
    log_info "Existing yt-dlp found at ${CURRENT_BIN} ($(yt-dlp --version 2>/dev/null || echo 'unknown'))."
    log_info "Updating yt-dlp to latest release..."
    if yt-dlp -U 2>/dev/null; then
        log_success "yt-dlp updated successfully to version $(yt-dlp --version)."
        INSTALLED_YTDLP=true
    else
        log_warn "yt-dlp self-update was skipped or not supported for this binary build."
    fi
fi

# If not installed or update was not applicable, install official standalone release
if [ "$INSTALLED_YTDLP" = false ]; then
    log_info "Downloading latest standalone yt-dlp binary to ${YTDLP_TARGET}..."
    if curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${YTDLP_TARGET}"; then
        chmod a+rx "${YTDLP_TARGET}"
        log_success "Downloaded and configured ${YTDLP_TARGET} executable."
        INSTALLED_YTDLP=true
    else
        log_warn "Direct download from GitHub failed. Attempting fallback installation methods..."
        # Fallback 1: python3 pip with --break-system-packages (Python 3.12+ compatible)
        if command -v pip3 >/dev/null 2>&1; then
            log_info "Attempting pip3 install yt-dlp..."
            if pip3 install -U yt-dlp --break-system-packages 2>/dev/null || pip3 install -U yt-dlp 2>/dev/null; then
                INSTALLED_YTDLP=true
            fi
        fi

        # Fallback 2: distribution apt package
        if [ "$INSTALLED_YTDLP" = false ]; then
            log_info "Attempting apt-get install yt-dlp..."
            apt-get install -y yt-dlp || true
            if command -v yt-dlp >/dev/null 2>&1; then
                INSTALLED_YTDLP=true
            fi
        fi
    fi
fi

# ------------------------------------------------------------------------------
# 5. Install Deno (Preferred Standalone JS Runtime for yt-dlp EJS)
# ------------------------------------------------------------------------------
log_info "Checking JavaScript runtime for yt-dlp..."
if command -v deno >/dev/null 2>&1; then
    log_success "Deno is already installed: $(deno --version 2>&1 | head -n1)"
else
    log_info "Installing Deno for yt-dlp..."
    if curl -fsSL https://deno.land/install.sh | sh >/dev/null 2>&1; then
        if [ -f "${HOME}/.deno/bin/deno" ]; then
            cp "${HOME}/.deno/bin/deno" /usr/local/bin/deno
            chmod a+rx /usr/local/bin/deno
            log_success "Deno installed to /usr/local/bin/deno: $(/usr/local/bin/deno --version | head -n1)"
        fi
    elif command -v node >/dev/null 2>&1; then
        log_info "Node.js is installed ($(node -v)) and will be used as the JS challenge runtime."
    else
        log_warn "Neither Deno nor Node.js detected. yt-dlp may have limited player extraction."
    fi
fi

# ------------------------------------------------------------------------------
# 6. Verification & Final Diagnostics
# ------------------------------------------------------------------------------
echo ""
echo -e "${CYAN}-----------------------------------------------------${NC}"
echo -e "${CYAN}             Verification & Diagnostics              ${NC}"
echo -e "${CYAN}-----------------------------------------------------${NC}"

ERRORS=0

if command -v ffmpeg >/dev/null 2>&1; then
    FF_PATH=$(command -v ffmpeg)
    FF_VER=$(ffmpeg -version 2>&1 | head -n1 | cut -d' ' -f1-3)
    log_success "FFmpeg binary:  ${FF_PATH} (${FF_VER})"
else
    log_error "FFmpeg binary not found in PATH."
    ERRORS=$((ERRORS + 1))
fi

if command -v yt-dlp >/dev/null 2>&1; then
    YT_PATH=$(command -v yt-dlp)
    YT_VER=$(yt-dlp --version 2>/dev/null || echo 'unknown')
    log_success "yt-dlp binary:  ${YT_PATH} (v${YT_VER})"
else
    log_error "yt-dlp binary not found in PATH."
    ERRORS=$((ERRORS + 1))
fi

if command -v deno >/dev/null 2>&1; then
    log_success "JS runtime:     $(command -v deno) ($(deno --version | head -n1))"
elif command -v node >/dev/null 2>&1; then
    log_success "JS runtime:     $(command -v node) ($(node -v))"
else
    log_warn "JS runtime:     None found. Extraction of some YouTube formats may fail."
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${GREEN}  All audio dependencies successfully installed!     ${NC}"
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "VoiceEngine's BinaryResolver will automatically detect these tools."
    echo ""
    echo -e "If voiceengine.service is currently running, restart it to reload tools:"
    echo -e "  ${YELLOW}sudo systemctl restart voiceengine${NC}"
    echo ""
else
    echo -e "${RED}=====================================================${NC}"
    echo -e "${RED}  Installation completed with errors (${ERRORS} missing tools) ${NC}"
    echo -e "${RED}=====================================================${NC}"
    exit 1
fi
