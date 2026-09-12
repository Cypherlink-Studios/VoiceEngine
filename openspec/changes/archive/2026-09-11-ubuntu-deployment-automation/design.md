## Context

VoiceEngine consists of three distinct subsystems with different runtime requirements:
1. `paper-plugin`: Java 21+ PaperMC plugin running inside a Minecraft server.
2. `voice-server`: Node.js 20+ backend utilizing `mediasoup` (WebRTC SFU with native C++ workers) and serving static files from `web-client/dist`.
3. `web-client`: Single-page React application running in player browsers with Web Audio API 3D spatialization.

In production on Ubuntu, browsers enforce that `navigator.mediaDevices.getUserMedia` is only accessible over HTTPS (or `localhost`). Additionally, WebRTC media streams require direct UDP port access (40000-40100) and explicit public IP announcement (`ANNOUNCED_IP`) to establish peer connections through NAT.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide a turn-key, idempotent Bash installation script (`scripts/install.sh`) for Ubuntu 22.04 and 24.04 LTS.
- Provide comprehensive, crystal-clear operational documentation (`docs/installation/DEPLOY.md`) covering architecture, manual installation, systemd, Nginx, SSL, firewall, and troubleshooting.
- Automate dependencies: Node.js 20 LTS via NodeSource, OpenJDK 21, Nginx, Certbot, build-essential/python3 for Mediasoup native compilation, and UFW firewall rules.
- Automate configuration of systemd service (`voiceengine.service`) with auto-recovery and logging.
- Support automated detection and interactive override of server public IP and domain.

**Non-Goals:**
- Docker containerization / Kubernetes orchestration (out of scope for this change; focused on bare-metal / VPS Ubuntu deployment).
- Managing or downloading the Minecraft server itself (Paper server installation is managed by the server administrator).
- Multi-host distributed SFU clustering (single-node SFU is sufficient for current architecture).

## Decisions

### 1. Nginx Reverse Proxy with WebSocket Upgrades
- **Decision**: Use Nginx to front HTTP port 80/443, proxying to `127.0.0.1:3000` and terminating TLS via Let's Encrypt / Certbot.
- **Rationale**: Browsers forbid microphone access on non-secure HTTP. Nginx is the standard, rock-solid reverse proxy on Ubuntu and seamlessly handles the WebSocket upgrade headers (`Upgrade` / `Connection`) required for `/ws/client` and `/ws/plugin`.
- **Alternative Considered**: Caddy (automatic TLS, but Nginx is far more prevalent in Ubuntu server administration and has standard apt package availability across all Ubuntu LTS versions).

### 2. Mediasoup Native Compilation Handling
- **Decision**: The installer explicitly installs `build-essential`, `python3`, `python3-pip`, and `pkg-config` before running `npm install` in `voice-server`.
- **Rationale**: `mediasoup` downloads and builds C++ worker binaries (`mediasoup-worker`) with Python and Meson/Ninja during `npm install`. Without these packages, `npm install` fails with native compilation errors.

### 3. Integrated Static Hosting via Express
- **Decision**: Let `voice-server` serve the compiled `web-client/dist` directory directly, while Nginx handles reverse proxying and SSL.
- **Rationale**: `voice-server/src/index.ts` already implements static file serving and fallback routing for `web-client/dist`. This eliminates the need for separate Nginx `root` directives and CORS complexity between the web client and WebSocket endpoints.

### 4. Interactive & Unattended Script Capabilities
- **Decision**: `scripts/install.sh` will support interactive mode with smart auto-detection (detecting public IP via `curl -s https://ifconfig.me` and generating random secrets with `openssl rand -hex 24`), while allowing environment variable overrides (`VOICE_DOMAIN`, `VOICE_IP`, `VOICE_SECRET`) for non-interactive / CI deployments.
- **Rationale**: Accommodates both quick terminal setups by humans and headless provisioning by server automation.

## Risks / Trade-offs

- **[Risk] Cloud Firewall / Security Group Blocking UDP Ports**:
  - *Mitigation*: Even if UFW opens UDP 40000-40100 on the host, external cloud providers (AWS EC2 Security Groups, GCP Firewall Rules, Oracle Cloud VCN, DigitalOcean Firewalls) may drop UDP packets. `docs/installation/DEPLOY.md` explicitly highlights cloud security group configuration and provides test commands (`nc -u` / `tcpdump`).
- **[Risk] Missing or Incorrect `ANNOUNCED_IP`**:
  - *Mitigation*: If `ANNOUNCED_IP` defaults to `127.0.0.1` on a remote server, WebRTC ICE connection fails silently. The script automatically probes the external IP address and writes it to `.env`, and documentation warns operators about NAT environments.
- **[Risk] Java Version Compatibility for Gradle**:
  - *Mitigation*: `paper-plugin` uses Java 25 toolchain configuration. The installer provisions OpenJDK 21, and Gradle downloads or resolves toolchains. The script verifies `./gradlew --version` and `./gradlew build`.
