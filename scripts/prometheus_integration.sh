#!/usr/bin/env bash
# ==============================================================================
# VoiceEngine - Prometheus & Grafana Observability Deployment Wizard
# ==============================================================================
# Provides automated provisioning of Prometheus TSDB and Grafana for VoiceEngine.
# Supported Deployment Modes: Docker Compose (Recommended) and Native Systemd.
# ==============================================================================

set -euo pipefail

# ANSI color codes for formatted terminal output
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

    if [ "$NON_INTERACTIVE" = "true" ] || [ ! -t 0 ]; then
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

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONITORING_DIR="${REPO_DIR}/monitoring"

# Auto-detect VoiceEngine port from voice-server/.env if present
VOICE_PORT="3000"
if [ -f "${REPO_DIR}/voice-server/.env" ]; then
    DETECTED_VOICE_PORT=$(grep -E '^[[:space:]]*PORT=' "${REPO_DIR}/voice-server/.env" 2>/dev/null | cut -d'=' -f2 | tr -d ' "\r\n' || true)
    if [ -n "$DETECTED_VOICE_PORT" ]; then
        VOICE_PORT="$DETECTED_VOICE_PORT"
    fi
fi

# Default configuration parameters
MODE=""
WITH_GRAFANA="true"
SCRAPE_INTERVAL="5s"
RETENTION="15d"
SECURITY="localhost"
GRAFANA_PORT="3001"
PROMETHEUS_PORT="9090"
NON_INTERACTIVE="false"
UNINSTALL="false"

print_usage() {
    echo -e "${BOLD}VoiceEngine Observability Deployment Script${NC}"
    echo ""
    echo -e "Usage:"
    echo -e "  sudo bash scripts/prometheus_integration.sh [OPTIONS]"
    echo ""
    echo -e "Options:"
    echo -e "  --mode <docker|systemd>      Deployment mode (docker: Docker Compose, systemd: native apt)"
    echo -e "  --with-grafana               Install Grafana with pre-built VoiceEngine dashboard (default)"
    echo -e "  --no-grafana                 Install Prometheus only"
    echo -e "  --scrape-interval <interval> Prometheus scrape interval (default: 5s, e.g. 2s, 5s, 15s)"
    echo -e "  --retention <period>         Prometheus TSDB data retention (default: 15d, e.g. 7d, 30d)"
    echo -e "  --security <policy>          Access policy: 'localhost' (SSH tunnel), 'open' (UFW open), or 'nginx'"
    echo -e "  --grafana-port <port>        Host port for Grafana (default: 3001)"
    echo -e "  --prometheus-port <port>     Host port for Prometheus (default: 9090)"
    echo -e "  --voice-port <port>          Target port where VoiceEngine is running (default: 3000 or detected from .env)"
    echo -e "  -y, --yes                    Non-interactive mode (use defaults or specified flags)"
    echo -e "  --uninstall                  Tear down and remove monitoring containers/services"
    echo -e "  -h, --help                   Show this help message and exit"
    echo ""
    echo -e "Examples:"
    echo -e "  sudo bash scripts/prometheus_integration.sh"
    echo -e "  sudo bash scripts/prometheus_integration.sh --mode docker --with-grafana -y"
    echo -e "  sudo bash scripts/prometheus_integration.sh --prometheus-port 9091 --grafana-port 3002"
    echo -e "  sudo bash scripts/prometheus_integration.sh --uninstall"
}

# ------------------------------------------------------------------------------
# 1. CLI Argument Parsing
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --with-grafana)
            WITH_GRAFANA="true"
            shift
            ;;
        --no-grafana)
            WITH_GRAFANA="false"
            shift
            ;;
        --scrape-interval)
            SCRAPE_INTERVAL="$2"
            shift 2
            ;;
        --retention)
            RETENTION="$2"
            shift 2
            ;;
        --security)
            SECURITY="$2"
            shift 2
            ;;
        --grafana-port)
            GRAFANA_PORT="$2"
            shift 2
            ;;
        --prometheus-port)
            PROMETHEUS_PORT="$2"
            shift 2
            ;;
        --voice-port)
            VOICE_PORT="$2"
            shift 2
            ;;
        -y|--yes)
            NON_INTERACTIVE="true"
            shift
            ;;
        --uninstall)
            UNINSTALL="true"
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown argument: $1"
            print_usage
            exit 1
            ;;
    esac
done

# ------------------------------------------------------------------------------
# 2. Uninstall Routine
# ------------------------------------------------------------------------------
if [ "$UNINSTALL" = "true" ]; then
    log_info "Initiating teardown of VoiceEngine monitoring stack..."

    if [ -f "${MONITORING_DIR}/docker-compose.yml" ]; then
        if command -v docker >/dev/null 2>&1; then
            log_info "Stopping and removing Docker monitoring containers..."
            docker compose -f "${MONITORING_DIR}/docker-compose.yml" down -v 2>/dev/null || \
            docker-compose -f "${MONITORING_DIR}/docker-compose.yml" down -v 2>/dev/null || true
        fi
        rm -f "${MONITORING_DIR}/docker-compose.yml"
    fi

    if systemctl is-active --quiet prometheus 2>/dev/null; then
        log_info "Stopping and disabling native prometheus.service..."
        systemctl stop prometheus || true
        systemctl disable prometheus || true
    fi

    rm -f "${MONITORING_DIR}/prometheus/prometheus.yml"
    log_success "VoiceEngine observability stack has been removed."
    exit 0
fi

# ------------------------------------------------------------------------------
# 3. Pre-flight Checks & Target Probing
# ------------------------------------------------------------------------------
log_info "Performing pre-flight health checks..."

# Check root privileges
if [ "$EUID" -ne 0 ]; then
    log_error "This script requires root privileges. Please run with sudo (e.g.: sudo bash scripts/prometheus_integration.sh)."
    exit 1
fi

# Probe VoiceEngine /metrics endpoint
if curl -fsS --max-time 2 "http://127.0.0.1:${VOICE_PORT}/metrics" >/dev/null 2>&1; then
    log_success "Detected active VoiceEngine metrics endpoint at http://127.0.0.1:${VOICE_PORT}/metrics"
else
    log_warn "VoiceEngine endpoint at http://127.0.0.1:${VOICE_PORT}/metrics is not reachable yet."
    log_warn "Prometheus will begin scraping automatically once VoiceEngine starts on port ${VOICE_PORT}."
fi

# ------------------------------------------------------------------------------
# 4. Interactive Wizard (if not in non-interactive mode)
# ------------------------------------------------------------------------------
if [ "$NON_INTERACTIVE" != "true" ] && [ -t 0 ]; then
    echo ""
    echo -e "${CYAN}==================================================================${NC}"
    echo -e "${CYAN}${BOLD}         VoiceEngine - Observability & Metrics Setup Wizard       ${NC}"
    echo -e "${CYAN}==================================================================${NC}"
    echo ""

    # Prompt 1: Deployment Mode
    if [ -z "$MODE" ]; then
        echo -e "${BOLD}[1/5] Select Deployment Architecture:${NC}"
        echo -e "  ${GREEN}1) Docker Compose (Recommended)${NC} - Isolated containers, turnkey Grafana"
        echo -e "  2) Native Systemd - Uses system packages (apt-get), lowest memory footprint"
        read -rp "Enter choice [1]: " INPUT_MODE
        case "${INPUT_MODE:-1}" in
            1) MODE="docker" ;;
            2) MODE="systemd" ;;
            *) MODE="docker" ;;
        esac
    fi

    # Prompt 2: Components
    echo ""
    echo -e "${BOLD}[2/5] Select Observability Components:${NC}"
    echo -e "  ${GREEN}1) Prometheus + Grafana (Recommended)${NC} - Includes pre-built VoiceEngine dashboard"
    echo -e "  2) Prometheus Only - TSDB engine with PromQL web interface"
    read -rp "Enter choice [1]: " INPUT_COMPONENTS
    case "${INPUT_COMPONENTS:-1}" in
        1) WITH_GRAFANA="true" ;;
        2) WITH_GRAFANA="false" ;;
        *) WITH_GRAFANA="true" ;;
    esac

    # Prompt 3: Scrape Interval
    echo ""
    echo -e "${BOLD}[3/5] Metric Collection Interval:${NC}"
    echo -e "  How often Prometheus scrapes VoiceEngine (e.g., 2s, 5s, 15s)."
    read -rp "Scrape interval [${SCRAPE_INTERVAL}]: " INPUT_INTERVAL
    SCRAPE_INTERVAL="${INPUT_INTERVAL:-$SCRAPE_INTERVAL}"

    # Prompt 4: Retention Period
    echo ""
    echo -e "${BOLD}[4/5] Data Retention Window:${NC}"
    echo -e "  How long metrics are retained in the TSDB (e.g., 7d, 15d, 30d)."
    read -rp "Retention period [${RETENTION}]: " INPUT_RETENTION
    RETENTION="${INPUT_RETENTION:-$RETENTION}"

    # Prompt 5: Security Policy
    echo ""
    echo -e "${BOLD}[5/5] Access & Security Policy:${NC}"
    echo -e "  ${GREEN}1) Localhost Only (Recommended)${NC} - Secure binding; access via SSH port forward"
    echo -e "  2) Reverse Proxy via Nginx - Protected with HTTP Basic Auth"
    echo -e "  3) Open Firewall Port - Unprotected (Development environments only)"
    read -rp "Enter choice [1]: " INPUT_SECURITY
    case "${INPUT_SECURITY:-1}" in
        1) SECURITY="localhost" ;;
        2) SECURITY="nginx" ;;
        3) SECURITY="open" ;;
        *) SECURITY="localhost" ;;
    esac
    echo ""
fi

# Fallback default if mode was not set
MODE="${MODE:-docker}"

# ------------------------------------------------------------------------------
# Port Verification & Collision Resolution
# ------------------------------------------------------------------------------
log_info "Verifying port availability and checking for potential conflicts..."
resolve_port_conflict "Prometheus" "$PROMETHEUS_PORT" PROMETHEUS_PORT

if [ "$WITH_GRAFANA" = "true" ]; then
    if [ "$GRAFANA_PORT" -eq "$PROMETHEUS_PORT" ]; then
        GRAFANA_PORT=$(find_next_free_port $((PROMETHEUS_PORT + 1)))
    fi
    resolve_port_conflict "Grafana" "$GRAFANA_PORT" GRAFANA_PORT
fi

log_info "Deployment Configuration Summary:"
log_info "  • Mode:             ${MODE}"
log_info "  • VoiceEngine Port: ${VOICE_PORT}"
log_info "  • Include Grafana:  ${WITH_GRAFANA}"
log_info "  • Scrape Interval:  ${SCRAPE_INTERVAL}"
log_info "  • Retention:        ${RETENTION}"
log_info "  • Security Policy:  ${SECURITY}"
log_info "  • Prometheus Port:  ${PROMETHEUS_PORT}"
[ "$WITH_GRAFANA" = "true" ] && log_info "  • Grafana Port:     ${GRAFANA_PORT}"

# Determine bind IP based on security policy
BIND_IP="127.0.0.1"
if [ "$SECURITY" = "open" ]; then
    BIND_IP="0.0.0.0"
fi

# ------------------------------------------------------------------------------
# 5. Generate Prometheus Configuration File
# ------------------------------------------------------------------------------
log_info "Generating Prometheus configuration..."
mkdir -p "${MONITORING_DIR}/prometheus"

TARGET_HOST="host.docker.internal:${VOICE_PORT}"
if [ "$MODE" = "systemd" ]; then
    TARGET_HOST="127.0.0.1:${VOICE_PORT}"
fi

sed -e "s|__SCRAPE_INTERVAL__|${SCRAPE_INTERVAL}|g" \
    -e "s|__VOICEENGINE_TARGET__|${TARGET_HOST}|g" \
    "${MONITORING_DIR}/prometheus/prometheus.yml.template" > "${MONITORING_DIR}/prometheus/prometheus.yml"

log_success "Created ${MONITORING_DIR}/prometheus/prometheus.yml"

# ------------------------------------------------------------------------------
# 6. Deployment Mode: Docker Compose
# ------------------------------------------------------------------------------
if [ "$MODE" = "docker" ]; then
    log_info "Verifying Docker and Docker Compose toolchain..."

    if ! command -v docker >/dev/null 2>&1; then
        log_warn "Docker is not installed on this system."
        log_info "Installing Docker via official convenience script..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable --now docker
        log_success "Docker installed successfully."
    fi

    # Determine compose command
    COMPOSE_CMD="docker compose"
    if ! docker compose version >/dev/null 2>&1; then
        if command -v docker-compose >/dev/null 2>&1; then
            COMPOSE_CMD="docker-compose"
        else
            log_info "Installing docker-compose-plugin..."
            apt-get update -y && apt-get install -y docker-compose-plugin || true
        fi
    fi

    log_info "Writing ${MONITORING_DIR}/docker-compose.yml..."
    cat <<EOF > "${MONITORING_DIR}/docker-compose.yml"
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: voiceengine-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=${RETENTION}'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "${BIND_IP}:${PROMETHEUS_PORT}:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    extra_hosts:
      - "host.docker.internal:host-gateway"
EOF

    if [ "$WITH_GRAFANA" = "true" ]; then
        cat <<EOF >> "${MONITORING_DIR}/docker-compose.yml"

  grafana:
    image: grafana/grafana:latest
    container_name: voiceengine-grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/etc/grafana/provisioning/dashboards/voiceengine-overview.json
    ports:
      - "${BIND_IP}:${GRAFANA_PORT}:3000"
    volumes:
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus
EOF
    fi

    cat <<EOF >> "${MONITORING_DIR}/docker-compose.yml"

volumes:
  prometheus_data:
  grafana_data:
EOF

    log_info "Starting monitoring containers with Docker Compose..."
    cd "${MONITORING_DIR}"
    $COMPOSE_CMD up -d
    log_success "Docker Compose monitoring services are up and running."

# ------------------------------------------------------------------------------
# 7. Deployment Mode: Native Systemd
# ------------------------------------------------------------------------------
elif [ "$MODE" = "systemd" ]; then
    log_info "Installing native Prometheus package..."
    apt-get update -y
    apt-get install -y prometheus

    log_info "Deploying Prometheus scrape configuration to /etc/prometheus/prometheus.yml..."
    if [ -f /etc/prometheus/prometheus.yml ] && [ ! -f /etc/prometheus/prometheus.yml.bak ]; then
        cp /etc/prometheus/prometheus.yml /etc/prometheus/prometheus.yml.bak
    fi

    cp "${MONITORING_DIR}/prometheus/prometheus.yml" /etc/prometheus/prometheus.yml

    # Configure custom listen address if port differs from default (9090) or bind IP is restricted
    if [ "$PROMETHEUS_PORT" != "9090" ] || [ "$BIND_IP" != "0.0.0.0" ]; then
        log_info "Configuring Prometheus listen address to ${BIND_IP}:${PROMETHEUS_PORT} in /etc/default/prometheus..."
        mkdir -p /etc/default
        if [ -f /etc/default/prometheus ] && grep -q "^ARGS=" /etc/default/prometheus; then
            sed -i "s|^ARGS=.*|ARGS=\"--web.listen-address=${BIND_IP}:${PROMETHEUS_PORT}\"|g" /etc/default/prometheus
        else
            echo "ARGS=\"--web.listen-address=${BIND_IP}:${PROMETHEUS_PORT}\"" >> /etc/default/prometheus
        fi
    fi

    systemctl daemon-reload
    systemctl restart prometheus
    systemctl enable prometheus
    log_success "Native prometheus.service updated and active on port ${PROMETHEUS_PORT}."

    if [ "$WITH_GRAFANA" = "true" ]; then
        log_info "Installing Grafana package..."
        apt-get install -y apt-transport-https software-properties-common wget
        mkdir -p /etc/apt/keyrings/
        wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | tee /etc/apt/keyrings/grafana.gpg > /dev/null
        echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | tee /etc/apt/sources.list.d/grafana.list
        apt-get update -y
        apt-get install -y grafana

        # Configure port to prevent collision with VoiceEngine and other services
        mkdir -p /etc/grafana/provisioning/datasources
        mkdir -p /etc/grafana/provisioning/dashboards
        cp "${MONITORING_DIR}/grafana/datasources/prometheus-datasource.yml" /etc/grafana/provisioning/datasources/
        sed -i "s|http://prometheus:9090|http://127.0.0.1:${PROMETHEUS_PORT}|g" /etc/grafana/provisioning/datasources/prometheus-datasource.yml
        cp "${MONITORING_DIR}/grafana/dashboards/dashboard-provider.yml" /etc/grafana/provisioning/dashboards/
        cp "${MONITORING_DIR}/grafana/dashboards/voiceengine-overview.json" /etc/grafana/provisioning/dashboards/

        # Set HTTP port to configured GRAFANA_PORT in grafana.ini
        sed -i "s|;http_port = 3000|http_port = ${GRAFANA_PORT}|g" /etc/grafana/grafana.ini

        systemctl daemon-reload
        systemctl restart grafana-server
        systemctl enable grafana-server
        log_success "Native grafana-server service updated and active on port ${GRAFANA_PORT}."
    fi
fi

# ------------------------------------------------------------------------------
# 8. Firewall (UFW) Configuration
# ------------------------------------------------------------------------------
if [ "$SECURITY" = "open" ] && command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        log_info "Configuring UFW rules for public monitoring ports..."
        ufw allow "${PROMETHEUS_PORT}/tcp" comment 'Prometheus TSDB' || true
        [ "$WITH_GRAFANA" = "true" ] && ufw allow "${GRAFANA_PORT}/tcp" comment 'Grafana Dashboard' || true
        log_success "Firewall rules updated for monitoring access."
    fi
fi

# ------------------------------------------------------------------------------
# 9. Deployment Summary & Next Steps
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}${BOLD}      VoiceEngine Observability Stack Deployment Complete!        ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "• Prometheus Web UI:    http://${BIND_IP}:${PROMETHEUS_PORT}"
if [ "$WITH_GRAFANA" = "true" ]; then
    echo -e "• Grafana Dashboard:    http://${BIND_IP}:${GRAFANA_PORT}"
    echo -e "  - Default User:       admin"
    echo -e "  - Default Password:   admin"
    echo -e "  - Pre-built Model:    VoiceEngine Production Overview"
fi
echo ""

if [ "$SECURITY" = "localhost" ]; then
    echo -e "${YELLOW}${BOLD}SECURE ACCESS INSTRUCTIONS (SSH Port Forwarding):${NC}"
    echo -e "Because services are bound to localhost, forward the ports to your local machine:"
    if [ "$WITH_GRAFANA" = "true" ]; then
        echo -e "  ${CYAN}ssh -L ${GRAFANA_PORT}:localhost:${GRAFANA_PORT} -L ${PROMETHEUS_PORT}:localhost:${PROMETHEUS_PORT} user@your-server-ip${NC}"
        echo -e "Then open ${BOLD}http://localhost:${GRAFANA_PORT}${NC} in your local browser."
    else
        echo -e "  ${CYAN}ssh -L ${PROMETHEUS_PORT}:localhost:${PROMETHEUS_PORT} user@your-server-ip${NC}"
        echo -e "Then open ${BOLD}http://localhost:${PROMETHEUS_PORT}${NC} in your local browser."
    fi
    echo ""
fi

echo -e "• Documentation Guide:  ${REPO_DIR}/docs/observability/PROMETHEUS_GRAFANA.md"
echo -e "• Uninstall Command:    sudo bash scripts/prometheus_integration.sh --uninstall"
echo ""
