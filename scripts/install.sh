#!/usr/bin/env bash
# ==============================================================================
# VoiceEngine - Automated Ubuntu Deployment Script
# ==============================================================================
# Supported: Ubuntu 22.04 LTS (Jammy) / Ubuntu 24.04 LTS (Noble)
# ==============================================================================

set -euo pipefail

# ANSI color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
# Port Inspection & Conflict Resolution Helpers
# ------------------------------------------------------------------------------
is_port_in_use() {
    local port="$1"
    # Check using ss if available
    if command -v ss >/dev/null 2>&1; then
        if ss -tuln 2>/dev/null | grep -qE "(:|\[::\]|0\.0\.0\.0:)${port}\b"; then
            return 0
        fi
    fi
    # Check using lsof if available
    if command -v lsof >/dev/null 2>&1; then
        if lsof -iTCP:"${port}" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
            return 0
        fi
    fi
    # Check using netstat if available
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tuln 2>/dev/null | grep -qE "(:|\[::\]|0\.0\.0\.0:)${port}\b"; then
            return 0
        fi
    fi
    # Fallback to bash pseudo-device /dev/tcp (checks active socket binding)
    if (exec 3<>/dev/tcp/127.0.0.1/"${port}") 2>/dev/null; then
        exec 3<&-
        exec 3>&-
        return 0
    fi
    return 1
}

get_port_process() {
    local port="$1"
    local proc_info=""
    if command -v lsof >/dev/null 2>&1; then
        proc_info=$(lsof -iTCP:"${port}" -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR>1 {print $1, "(PID: " $2 ")"}' | head -n 1)
    fi
    if [ -z "$proc_info" ] && command -v fuser >/dev/null 2>&1; then
        local pid
        pid=$(fuser "${port}/tcp" 2>/dev/null | tr -s ' ' | xargs 2>/dev/null || true)
        if [ -n "$pid" ]; then
            local pname
            pname=$(ps -p "$pid" -o comm= 2>/dev/null || echo "process")
            proc_info="${pname} (PID: ${pid})"
        fi
    fi
    if [ -z "$proc_info" ] && command -v ss >/dev/null 2>&1; then
        proc_info=$(ss -tulpn "sport = :${port}" 2>/dev/null | grep -o 'users:((".*"))' | head -n 1)
    fi
    if [ -z "$proc_info" ]; then
        echo "an active service"
    else
        echo "$proc_info"
    fi
}

find_next_free_port() {
    local start_port="$1"
    local candidate="$start_port"
    local max_attempts=50
    local attempt=0
    while [ "$attempt" -lt "$max_attempts" ]; do
        if ! is_port_in_use "$candidate"; then
            echo "$candidate"
            return 0
        fi
        candidate=$((candidate + 1))
        attempt=$((attempt + 1))
    done
    echo "$start_port"
    return 1
}

resolve_port_conflict() {
    local service_name="$1"
    local current_port="$2"
    local var_name="$3"

    if ! is_port_in_use "$current_port"; then
        log_info "Port ${current_port} is available for ${service_name}."
        return 0
    fi

    local proc
    proc=$(get_port_process "$current_port")
    local suggested_port
    suggested_port=$(find_next_free_port $((current_port + 1)))

    log_warn "Port collision detected: Port ${current_port} is currently in use by ${proc}!"

    if [ "${NON_INTERACTIVE:-false}" = "true" ] || [ ! -t 0 ]; then
        log_info "Non-interactive mode active: Automatically reallocating ${service_name} to free port ${suggested_port}."
        printf -v "$var_name" '%s' "$suggested_port"
        return 0
    fi

    echo ""
    echo -e "${YELLOW}${BOLD}[!] Port Conflict Resolution for ${service_name}:${NC}"
    echo -e "  Default port ${BOLD}${current_port}${NC} is occupied by ${CYAN}${proc}${NC}."
    echo -e "  Suggested available port: ${GREEN}${suggested_port}${NC}"

    local chosen_port=""
    while true; do
        read -rp "Enter port to use for ${service_name} [${suggested_port}]: " INPUT_PORT
        chosen_port="${INPUT_PORT:-$suggested_port}"

        if [[ ! "$chosen_port" =~ ^[0-9]+$ ]] || [ "$chosen_port" -lt 1 ] || [ "$chosen_port" -gt 65535 ]; then
            log_error "Invalid port number '${chosen_port}'. Please enter a valid port between 1 and 65535."
            continue
        fi

        if [ "$chosen_port" != "$current_port" ] && is_port_in_use "$chosen_port"; then
            local occupying
            occupying=$(get_port_process "$chosen_port")
            log_warn "Port ${chosen_port} is also occupied by ${occupying}."
            local next_free
            next_free=$(find_next_free_port $((chosen_port + 1)))
            echo -e "  Suggested alternative: ${GREEN}${next_free}${NC}"
            continue
        fi

        break
    done

    printf -v "$var_name" '%s' "$chosen_port"
    log_success "Port for ${service_name} set to ${chosen_port}."
}

# ------------------------------------------------------------------------------
# 1. Privileges and OS Compatibility Verification
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root or with sudo privileges (e.g.: sudo bash scripts/install.sh)"
    exit 1
fi

if [ ! -f /etc/os-release ]; then
    log_error "Unable to determine operating system (/etc/os-release not found)."
    exit 1
fi

. /etc/os-release
if [ "$ID" != "ubuntu" ]; then
    log_warn "Detected OS is '${ID}'. This installer is optimized for Ubuntu."
fi

# Determine base repository directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
log_info "Repository root detected at: ${REPO_DIR}"

# ------------------------------------------------------------------------------
# 2. Interactive Discovery / Environment Variables
# ------------------------------------------------------------------------------
echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}        VoiceEngine - Ubuntu Installation Wizard     ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Public IP discovery for WebRTC ICE
DETECTED_IP=$(curl -s --max-time 5 https://ifconfig.me || curl -s --max-time 5 https://icanhazip.com || echo "127.0.0.1")
VOICE_IP="${VOICE_IP:-}"
if [ -z "$VOICE_IP" ]; then
    if [ -t 0 ]; then
        read -rp "Public IPv4 address for WebRTC [${DETECTED_IP}]: " INPUT_IP
        VOICE_IP="${INPUT_IP:-$DETECTED_IP}"
    else
        VOICE_IP="$DETECTED_IP"
    fi
fi
log_info "Configured WebRTC public IP: ${VOICE_IP}"

# Public domain name for web client & HTTPS
VOICE_DOMAIN="${VOICE_DOMAIN:-}"
if [ -z "$VOICE_DOMAIN" ]; then
    if [ -t 0 ]; then
        read -rp "Domain name for web client (e.g. voice.yourdomain.com): " VOICE_DOMAIN
    else
        VOICE_DOMAIN="localhost"
    fi
fi
log_info "Configured domain name: ${VOICE_DOMAIN}"

# Shared secret key between backend and Paper plugin
VOICE_SECRET="${VOICE_SECRET:-}"
if [ -z "$VOICE_SECRET" ]; then
    VOICE_SECRET=$(openssl rand -hex 24)
    log_info "Automatically generated random secret key: ${VOICE_SECRET}"
else
    log_info "Using secret key provided via environment variable."
fi

# Number of Mediasoup workers (defaults to CPU core count)
DETECTED_CORES=$(nproc 2>/dev/null || echo 2)
MEDIASOUP_NUM_WORKERS="${MEDIASOUP_NUM_WORKERS:-$DETECTED_CORES}"
log_info "Configured Mediasoup workers: ${MEDIASOUP_NUM_WORKERS}"

# Optional Discord Webhook URL for watchdog health alerts
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
if [ -z "$DISCORD_WEBHOOK_URL" ] && [ -t 0 ]; then
    read -rp "Discord Webhook URL for health alerts (optional, press Enter to skip): " INPUT_DISCORD
    DISCORD_WEBHOOK_URL="${INPUT_DISCORD:-}"
fi
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    log_info "Configured Discord health watchdog alerts."
fi

# VoiceEngine Backend HTTP and WebSocket Port
VOICE_PORT="${VOICE_PORT:-3000}"
resolve_port_conflict "VoiceEngine Backend" "$VOICE_PORT" VOICE_PORT
log_info "Configured VoiceEngine port: ${VOICE_PORT}"


# ------------------------------------------------------------------------------
# 3. System Package Provisioning
# ------------------------------------------------------------------------------
log_info "Updating package lists..."
if ! apt-get update -y; then
    log_warn "apt-get update encountered errors (commonly caused by broken or outdated third-party PPAs)."
    log_warn "Continuing package installation with available package lists..."
fi

log_info "Installing system packages and native build toolchain..."
apt-get install -y \
    curl \
    wget \
    git \
    tar \
    xz-utils \
    openssl \
    build-essential \
    python3 \
    python3-pip \
    pkg-config \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    jq

# ------------------------------------------------------------------------------
# Install OpenJDK 21 (for Gradle toolchain and PaperMC)
# ------------------------------------------------------------------------------
log_info "Installing OpenJDK 21 / Java runtime..."
if ! apt-get install -y openjdk-21-jdk; then
    log_warn "openjdk-21-jdk package not found in current repositories. Installing default-jdk..."
    apt-get install -y default-jdk
fi

# ------------------------------------------------------------------------------
# Install Node.js 20+ and npm (NodeSource with standalone binary fallback)
# ------------------------------------------------------------------------------
INSTALL_NODE=true
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge 20 ]; then
        log_success "Node.js $(node -v) and npm $(npm -v) are already installed."
        INSTALL_NODE=false
    fi
fi

if [ "$INSTALL_NODE" = true ]; then
    log_info "Attempting to install Node.js 20 LTS and npm via NodeSource..."
    NODE_INSTALLED=false
    if curl -fsSL https://deb.nodesource.com/setup_20.x | bash -; then
        if apt-get install -y nodejs; then
            if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
                NODE_INSTALLED=true
                log_success "Node.js $(node -v) and npm $(npm -v) installed via NodeSource."
            fi
        fi
    fi

    # Fallback to official standalone pre-compiled Node.js binary if NodeSource repository fails
    if [ "$NODE_INSTALLED" = false ]; then
        log_warn "NodeSource repository setup was unsuccessful or unsupported. Installing official Node.js v22.14.0 LTS binary..."
        ARCH=$(uname -m)
        NODE_ARCH="x64"
        if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
            NODE_ARCH="arm64"
        fi
        NODE_TAR="node-v22.14.0-linux-${NODE_ARCH}.tar.xz"
        curl -fsSL "https://nodejs.org/dist/v22.14.0/${NODE_TAR}" -o "/tmp/${NODE_TAR}"
        tar -xJf "/tmp/${NODE_TAR}" -C /usr/local --strip-components=1 --no-same-owner
        rm -f "/tmp/${NODE_TAR}"
        log_success "Node.js $(node -v) and npm $(npm -v) installed successfully via official binary."
    fi
fi

# Ensure npm is present if system packaged nodejs separately
if ! command -v npm >/dev/null 2>&1; then
    log_info "Installing npm package explicitly..."
    apt-get install -y npm || true
fi

# ------------------------------------------------------------------------------
# Verify required dependency tools
# ------------------------------------------------------------------------------
log_info "Verifying required dependency tools..."
for tool in node npm java git curl nginx; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        log_error "Critical dependency '$tool' is not installed or not in PATH."
        exit 1
    fi
    log_success "Found $tool: $(command -v "$tool")"
done

# ------------------------------------------------------------------------------
# Install Audio Tools (FFmpeg & yt-dlp)
# ------------------------------------------------------------------------------
if [ -f "${REPO_DIR}/scripts/install_audio_tools.sh" ]; then
    log_info "Invoking audio tools installer..."
    bash "${REPO_DIR}/scripts/install_audio_tools.sh" || log_warn "Audio tools installation finished with warnings."
fi

# ------------------------------------------------------------------------------
# 4. Monorepo Build Sequence
# ------------------------------------------------------------------------------
log_info "--- Building Web Client (web-client) ---"
cd "${REPO_DIR}/web-client"
npm install
npm run build
log_success "Web client built successfully in web-client/dist"

log_info "--- Building Voice Server (voice-server) ---"
cd "${REPO_DIR}/voice-server"
npm install
npm run build
log_success "Voice server built successfully in voice-server/dist"

log_info "--- Building Paper Plugin (paper-plugin) ---"
cd "${REPO_DIR}/paper-plugin"
WRAPPER_JAR="${REPO_DIR}/paper-plugin/gradle/wrapper/gradle-wrapper.jar"
if [ ! -f "$WRAPPER_JAR" ] || [ ! -s "$WRAPPER_JAR" ]; then
    log_warn "gradle-wrapper.jar not found. Downloading Gradle wrapper binary..."
    mkdir -p "$(dirname "$WRAPPER_JAR")"
    curl -fsSL "https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar" -o "$WRAPPER_JAR" || true
fi
chmod +x gradlew
./gradlew build -x test
log_success "Paper plugin built successfully in paper-plugin/build/libs/"

# ------------------------------------------------------------------------------
# 5. Environment Configuration (.env)
# ------------------------------------------------------------------------------
log_info "Generating configuration file at ${REPO_DIR}/voice-server/.env..."
cat <<EOF > "${REPO_DIR}/voice-server/.env"
PORT=${VOICE_PORT}
HOST=0.0.0.0
NODE_ENV=production
SECRET_KEY=${VOICE_SECRET}
ENABLE_DEV_TOKENS=false

# WebRTC / Mediasoup SFU & Multi-Worker Architecture
ANNOUNCED_IP=${VOICE_IP}
LISTEN_IP=0.0.0.0
MEDIASOUP_NUM_WORKERS=${MEDIASOUP_NUM_WORKERS}
RTC_MIN_PORT=40000
RTC_MAX_PORT=49999

# Spatial proximity thresholds (in Minecraft blocks)
MAX_VOICE_DISTANCE=30.0
SNEAK_VOICE_DISTANCE=8.0

# Observability & Watchdog Health Alerts
EOF

if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    echo "DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}" >> "${REPO_DIR}/voice-server/.env"
else
    echo "# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_id/your_webhook_token" >> "${REPO_DIR}/voice-server/.env"
fi

cat <<EOF >> "${REPO_DIR}/voice-server/.env"

# Media & Storage Settings
MEDIA_MAX_CACHE_SIZE_MB=1024
MEDIA_MAX_CACHE_AGE_DAYS=7
EOF
log_success "Created voice-server/.env configuration file."

# ------------------------------------------------------------------------------
# 6. Systemd Service Registration
# ------------------------------------------------------------------------------
log_info "Configuring systemd service 'voiceengine.service'..."
SERVICE_FILE="/etc/systemd/system/voiceengine.service"
NODE_BIN=$(command -v node)

cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=VoiceEngine WebRTC SFU Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${REPO_DIR}/voice-server
Environment=NODE_ENV=production
ExecStart=${NODE_BIN} dist/index.js
Restart=always
RestartSec=5
TimeoutStopSec=15
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable voiceengine
systemctl restart voiceengine
log_success "Service voiceengine registered, enabled at boot, and started."

# ------------------------------------------------------------------------------
# 7. Nginx Reverse Proxy Configuration
# ------------------------------------------------------------------------------
log_info "Configuring Nginx reverse proxy for domain ${VOICE_DOMAIN}..."
NGINX_CONF="/etc/nginx/sites-available/voiceengine"

cat <<EOF > "${NGINX_CONF}"
server {
    listen 80;
    server_name ${VOICE_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${VOICE_PORT};
        proxy_http_version 1.1;

        # WebSocket Upgrade headers
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/voiceengine
# Remove default site to prevent port 80 routing conflicts
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
fi

if nginx -t; then
    systemctl reload nginx
    log_success "Nginx configuration verified and reloaded successfully."
else
    log_error "Syntax error detected in Nginx configuration."
fi

# ------------------------------------------------------------------------------
# 8. SSL Certificate via Certbot (Optional Interactive)
# ------------------------------------------------------------------------------
if [ "$VOICE_DOMAIN" != "localhost" ] && [ "$VOICE_DOMAIN" != "127.0.0.1" ]; then
    DO_SSL="n"
    if [ -t 0 ]; then
        read -rp "Would you like to obtain a free SSL certificate with Let's Encrypt now? (y/n): " DO_SSL
    fi

    if [[ "$DO_SSL" =~ ^[sSyY]$ ]]; then
        log_info "Requesting SSL certificate from Certbot for ${VOICE_DOMAIN}..."
        certbot --nginx -d "${VOICE_DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email || log_warn "Certbot completed with warnings. Verify your DNS records."
    else
        log_warn "Skipping SSL setup. REMINDER: Browsers require HTTPS to grant microphone permissions."
    fi
fi

# ------------------------------------------------------------------------------
# 9. Firewall Configuration (UFW)
# ------------------------------------------------------------------------------
log_info "Configuring UFW firewall rules..."
ufw allow 22/tcp comment 'SSH' || true
ufw allow 80/tcp comment 'HTTP / Certbot' || true
ufw allow 443/tcp comment 'HTTPS / VoiceEngine' || true
ufw allow 25565/tcp comment 'Minecraft Paper' || true
ufw allow 40000:49999/udp comment 'Mediasoup WebRTC Media' || true

if ! ufw status | grep -q "Status: active"; then
    log_info "Enabling UFW firewall..."
    ufw --force enable || true
fi
log_success "Firewall rules configured and active."

# ------------------------------------------------------------------------------
# 10. Deployment Summary
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}      VoiceEngine Deployment Completed!             ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "• Service Status:        systemctl status voiceengine"
echo -e "• Backend Port:          ${VOICE_PORT}"
echo -e "• Web Client URL:        https://${VOICE_DOMAIN}"
echo -e "• Backend Secret Key:    ${VOICE_SECRET}"
echo -e "• Paper Plugin Artifact: ${REPO_DIR}/paper-plugin/build/libs/VoiceEngine-paper-1.0.0-SNAPSHOT.jar"
echo ""
echo -e "${YELLOW}FINAL STEPS ON YOUR PAPER MINECRAFT SERVER:${NC}"
echo -e "1. Copy the plugin JAR to your Paper server's 'plugins/' folder."
echo -e "2. Configure 'plugins/VoiceEngine/config.yml' with:"
echo -e "   voice-server-url: \"ws://127.0.0.1:${VOICE_PORT}/ws/plugin\""
echo -e "   web-client-url: \"https://${VOICE_DOMAIN}\""
echo -e "   secret-key: \"${VOICE_SECRET}\""
echo ""
