## Why

Deploying VoiceEngine on a production Ubuntu server requires orchestrating multiple heterogenous runtimes and network configurations: Node.js 20+, Mediasoup native C++ compilation toolchains (Python, make, g++), OpenJDK 21 for the Paper plugin, Nginx reverse proxy with WebSocket upgrade support, HTTPS/SSL certificates required for Web Audio microphone capture in browsers, systemd background daemonization, and UFW firewall port ranges for WebRTC UDP media. An automated installation script and comprehensive deployment documentation eliminate setup friction and prevent common deployment misconfigurations (such as blocked microphone permissions or broken WebRTC ICE candidate routing).

## What Changes

- **Deployment Documentation (`docs/installation/DEPLOY.md`)**: Complete step-by-step production operations manual detailing prerequisites, OS packages, environment variables, Nginx reverse proxy setup with TLS/Certbot, systemd unit files, firewall rules, and troubleshooting diagnostics.
- **Automated Installation Script (`scripts/install.sh`)**: Idempotent, robust Bash deployment script for Ubuntu (22.04 / 24.04 LTS) that automates package provisioning, Node.js and Java setup, Mediasoup build dependencies, monorepo project builds (`web-client`, `voice-server`, `paper-plugin`), environment file generation with secure random secrets and announced public IP detection, systemd service creation, Nginx site configuration, and UFW firewall setup.

## Capabilities

### New Capabilities
- `deployment-automation`: End-to-end Ubuntu deployment automation, systemd daemonization, Nginx reverse proxy with SSL/TLS and WebSocket support, and production operations documentation.

### Modified Capabilities
<!-- None: No changes to existing paper-voice-bridge, voice-backend-sfu, or web-client-spatial-audio runtime specifications -->

## Impact

- **New Files**:
  - `docs/installation/DEPLOY.md`: Production deployment guide.
  - `scripts/install.sh`: Fully autonomous Ubuntu installation and setup script.
- **Affected Systems & Environment**:
  - Ubuntu 22.04/24.04 LTS target environments.
  - Systemd service `voiceengine.service`.
  - Nginx configuration `/etc/nginx/sites-available/voiceengine`.
  - Firewall ports: TCP 80, 443, 25565; UDP 40000-40100.
