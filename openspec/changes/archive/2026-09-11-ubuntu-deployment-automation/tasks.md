## 1. Documentation

- [x] 1.1 Create `docs/installation/DEPLOY.md` with full architectural topology, hardware/network prerequisites, automated install guide, manual step-by-step instructions (Node.js 20, Java 21, build-essential, systemd, Nginx, Certbot SSL, UFW), and troubleshooting diagnostics, and verify file completeness and formatting.

## 2. Automated Installer Script

- [x] 2.1 Create `scripts/install.sh` with root check, system dependency installation (`curl`, `build-essential`, `python3`, `pkg-config`, `openjdk-21-jdk`, `nginx`, `certbot`, `ufw`), and verify syntax with `bash -n scripts/install.sh`.
- [x] 2.2 Implement monorepo build orchestration (`web-client`, `voice-server`, `paper-plugin`), public IP discovery, `.env` generation with random secret, systemd service registration (`voiceengine.service`), Nginx site configuration, and UFW firewall rule setup in `scripts/install.sh`, and verify script execution logic.

## 3. Validation

- [x] 3.1 Validate the OpenSpec change using `openspec validate --change ubuntu-deployment-automation --strict` and verify that all artifacts and specifications pass with zero errors.
