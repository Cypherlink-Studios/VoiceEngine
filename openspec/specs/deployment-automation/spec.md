# deployment-automation Specification

## Purpose
Provides automated installation scripts and comprehensive production deployment documentation for deploying VoiceEngine on Ubuntu Linux with systemd, Nginx, TLS, and WebRTC media firewall routing.

## Requirements

### Requirement: Automated Host Environment Provisioning
The automated installer script SHALL verify root/sudo privileges and install all required system packages: Node.js 20+ LTS via NodeSource, OpenJDK 21, build-essential, python3, pkg-config, nginx, certbot, python3-certbot-nginx, and ufw.

#### Scenario: Installer runs on supported Ubuntu system
- **WHEN** an operator runs `scripts/install.sh` on Ubuntu 22.04 or 24.04 with root/sudo privileges
- **THEN** the script verifies OS compatibility, installs missing package repositories, and provisions all necessary development runtimes and build tools without failure.

#### Scenario: Installer runs without root privileges
- **WHEN** an operator runs `scripts/install.sh` without root or sudo permissions
- **THEN** the script terminates immediately with a clear explanatory error message and non-zero exit code.

### Requirement: Automated Monorepo Build and Packaging
The installer script SHALL build the client, server, and plugin components sequentially in their respective subdirectories: building the Web Client bundle into `web-client/dist`, compiling TypeScript into `voice-server/dist`, and compiling the Paper plugin into `paper-plugin/build/libs/*.jar`.

#### Scenario: Clean monorepo build
- **WHEN** the installation script reaches the build phase
- **THEN** `npm install` and `npm run build` succeed for `web-client`, native Mediasoup bindings and TypeScript build succeed for `voice-server`, and `./gradlew build` generates the Paper plugin JAR.

### Requirement: Automated Configuration and Secrets Generation
The installer script SHALL interactively query (or automatically discover via external IP detection) the server public IP address and domain name, generate a cryptographically secure random `SECRET_KEY`, and write a valid `.env` file in `voice-server/.env`.

#### Scenario: Environment configuration file generation
- **WHEN** the installation script configures the voice server
- **THEN** a `voice-server/.env` file is generated containing `PORT=3000`, `HOST=0.0.0.0`, `SECRET_KEY=<generated-secret>`, `LISTEN_IP=0.0.0.0`, `ANNOUNCED_IP=<server-ip>`, and WebRTC port boundaries `RTC_MIN_PORT=40000` / `RTC_MAX_PORT=40100`.

### Requirement: Automated Systemd Daemonization
The deployment system SHALL install and register a systemd service file `/etc/systemd/system/voiceengine.service` configured with `Restart=always`, dedicated working directory, environment loading, and unprivileged user execution.

#### Scenario: Systemd service starts and persists across reboots
- **WHEN** the installer completes service installation
- **THEN** `voiceengine.service` is reloaded, enabled at boot, and started, returning an active running state upon `systemctl status voiceengine`.

### Requirement: Nginx Reverse Proxy with WebSocket Termination
The deployment system SHALL configure an Nginx server block proxying HTTP requests to `http://127.0.0.1:3000`, handling WebSocket connection upgrade headers for `/ws/client` and `/ws/plugin`, and prompting for automated SSL certificate issuance via Certbot.

#### Scenario: Web and WebSocket traffic routing
- **WHEN** an external user connects to `https://<domain>/` or `wss://<domain>/ws/client`
- **THEN** Nginx proxies the connection to `127.0.0.1:3000` preserving Host and WebSocket upgrade headers, enabling secure browser microphone access.

### Requirement: WebRTC Media and Game Port Provisioning
The deployment system SHALL configure the host firewall (UFW) to permit inbound traffic on ports TCP 80, TCP 443, TCP 25565 (Minecraft), and UDP 40000-40100 (Mediasoup WebRTC media streams).

#### Scenario: Firewall rules active
- **WHEN** the firewall configuration step runs
- **THEN** `ufw status` shows active rules for 80/tcp, 443/tcp, 25565/tcp, and 40000:40100/udp.

### Requirement: Comprehensive Operations Documentation
The repository SHALL contain `docs/installation/DEPLOY.md` detailing end-to-end architecture, manual step-by-step setup commands, environment variables, Nginx configuration snippets, Paper plugin setup, and diagnostic troubleshooting commands.

#### Scenario: Operator references deployment manual
- **WHEN** a system administrator reads `docs/installation/DEPLOY.md`
- **THEN** the document provides full architectural diagrams, manual copy-paste instructions for every tier, and troubleshooting steps for microphone permissions, ICE candidate failures, and plugin disconnections.
