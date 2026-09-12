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
        log_warn "NodeSource repository setup was unsuccessful or unsupported. Installing official Node.js v20.18.0 binary..."
        ARCH=$(uname -m)
        NODE_ARCH="x64"
        if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
            NODE_ARCH="arm64"
        fi
        NODE_TAR="node-v20.18.0-linux-${NODE_ARCH}.tar.xz"
        curl -fsSL "https://nodejs.org/dist/v20.18.0/${NODE_TAR}" -o "/tmp/${NODE_TAR}"
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
chmod +x gradlew
./gradlew build -x test
log_success "Paper plugin built successfully in paper-plugin/build/libs/"

# ------------------------------------------------------------------------------
# 5. Environment Configuration (.env)
# ------------------------------------------------------------------------------
log_info "Generating configuration file at ${REPO_DIR}/voice-server/.env..."
cat <<EOF > "${REPO_DIR}/voice-server/.env"
PORT=3000
HOST=0.0.0.0
SECRET_KEY=${VOICE_SECRET}

# Spatial proximity thresholds (in Minecraft blocks)
MAX_VOICE_DISTANCE=30.0
SNEAK_VOICE_DISTANCE=8.0

# Mediasoup WebRTC networking
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100
LISTEN_IP=0.0.0.0
ANNOUNCED_IP=${VOICE_IP}
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
        proxy_pass http://127.0.0.1:3000;
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
ufw allow 40000:40100/udp comment 'Mediasoup WebRTC Media' || true

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
echo -e "• Web Client URL:        https://${VOICE_DOMAIN}"
echo -e "• Backend Secret Key:    ${VOICE_SECRET}"
echo -e "• Paper Plugin Artifact: ${REPO_DIR}/paper-plugin/build/libs/paper-plugin-1.0.0-SNAPSHOT.jar"
echo ""
echo -e "${YELLOW}FINAL STEPS ON YOUR PAPER MINECRAFT SERVER:${NC}"
echo -e "1. Copy the plugin JAR to your Paper server's 'plugins/' folder."
echo -e "2. Configure 'plugins/VoiceEngine/config.yml' with:"
echo -e "   voice-server-url: \"ws://127.0.0.1:3000/ws/plugin\""
echo -e "   web-client-url: \"https://${VOICE_DOMAIN}\""
echo -e "   secret-key: \"${VOICE_SECRET}\""
echo ""
