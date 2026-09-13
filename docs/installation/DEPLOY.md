# Production Deployment Guide (Ubuntu Linux)

> **VoiceEngine**: Zero-mod, click-and-connect 3D proximity voice chat for Paper Minecraft servers.

This guide provides comprehensive instructions for deploying VoiceEngine on a server running **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**.

---

## 1. Topology and Network Architecture

```
                         INTERNET / PLAYERS
                                 │
            ┌────────────────────┴────────────────────┐
            │                                         │
     TCP 80, 443 (HTTPS/WSS)                   UDP 40000-40100 (WebRTC Media)
            │                                         │
            ▼                                         │
   ┌──────────────────┐                               │
   │  Nginx + Certbot │                               │
   │ (SSL Termination)│                               │
   └────────┬─────────┘                               │
            │ HTTP & WebSocket Proxy                  │
            ▼                                         │
   ┌─────────────────────────────────────────────┐    │
   │        voice-server (Node.js/Systemd)       │    │
   │  - Internal Port: 3000                      │    │
   │  - Serves static SPA (web-client/dist)      │    │
   │  - WS Endpoints: /ws/client, /ws/plugin     │    │
   │  - Mediasoup SFU (Native C++ Worker) ───────┼────┘
   └──────────────────────▲──────────────────────┘
                          │
                          │ Local WS (ws://127.0.0.1:3000/ws/plugin)
                          │
   ┌──────────────────────┴──────────────────────┐
   │       Paper Minecraft Server (Java 21+)     │
   │  - Game Port: TCP 25565                     │
   │  - paper-plugin (VoiceEngine.jar)           │
   └─────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### Hardware and Operating System
* **OS**: Ubuntu 22.04 LTS (Jammy) or Ubuntu 24.04 LTS (Noble).
* **CPU / RAM**: Minimum 2 vCPUs and 4 GB RAM recommended to run both the Paper Minecraft server and the VoiceEngine SFU backend.
* **Domain**: A registered domain or subdomain pointing to your server's public IP address (e.g., `voice.yourdomain.com`).
  > **CRITICAL REQUIREMENT**: Modern web browsers (Chrome, Firefox, Edge, Safari) **strictly block microphone access** (`navigator.mediaDevices.getUserMedia`) over unencrypted HTTP (outside of `localhost`). An SSL/TLS certificate (HTTPS/WSS) is mandatory for players to speak.

### Required Network Ports
Ensure the following ports are open in both your host firewall (**UFW**) and your **Cloud Provider Security Groups / Firewalls** (AWS, Oracle Cloud, GCP, Hetzner, DigitalOcean, etc.):

| Port / Protocol | Service | Purpose |
| :--- | :--- | :--- |
| **80 / TCP** | HTTP | Certbot ACME domain validation and HTTPS redirection |
| **443 / TCP** | HTTPS | Web client traffic and secure WebSockets (`/ws/*`) |
| **25565 / TCP** | Minecraft | Player connections to PaperMC |
| **40000:40100 / UDP** | WebRTC / Mediasoup | RTP/RTCP media streams for 3D positional audio |

---

## 3. Quick Automated Deployment

VoiceEngine includes an interactive, autonomous installation script that installs system packages, builds all projects, configures systemd, sets up the Nginx virtual host, and enables firewall rules:

```bash
# Clone the repository if you haven't already
git clone https://github.com/Cypherlink-Studios/VoiceEngine.git /opt/VoiceEngine
cd /opt/VoiceEngine

# Grant execution permissions and run as root/sudo
chmod +x scripts/install.sh
sudo bash scripts/install.sh
```

The installer will prompt you to:
1. Provide or confirm your server's public IP address for WebRTC media routing.
2. Enter your domain name (e.g., `voice.yourdomain.com`).
3. Choose whether to automatically obtain a free SSL certificate via Let's Encrypt / Certbot.

---

## 4. Manual Step-by-Step Deployment

If you prefer to configure components manually or inspect each step, follow the instructions below:

### Step 1: Update the System and Install Native Build Tools
Mediasoup compiles native C++ binaries (`mediasoup-worker`) during package installation, which requires Python and standard C++ compilation toolchains:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git tar xz-utils openssl build-essential python3 python3-pip pkg-config nginx certbot python3-certbot-nginx ufw jq
```

### Step 2: Install Node.js 20 LTS
Install Node.js 20 using the official NodeSource repository:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # Should report v20.x.x
npm -v    # Should report v10.x.x
```

### Step 3: Install Java 21 (for PaperMC and Plugin)
```bash
sudo apt install -y openjdk-21-jdk
java -version
```

### Step 4: Build the Web Client (`web-client`)
The Voice Server serves the compiled static production assets directly:

```bash
cd /opt/VoiceEngine/web-client
npm install
npm run build
# Production assets will be generated in /opt/VoiceEngine/web-client/dist
```

### Step 5: Build the Voice Server (`voice-server`)
```bash
cd /opt/VoiceEngine/voice-server
npm install
npm run build
```

### Step 6: Configure Voice Server Environment Variables
Create `/opt/VoiceEngine/voice-server/.env`:

```bash
# Generate a cryptographically secure random secret
SECRET=$(openssl rand -hex 24)
PUBLIC_IP=$(curl -s https://ifconfig.me)

cat <<EOF > /opt/VoiceEngine/voice-server/.env
PORT=3000
HOST=0.0.0.0
SECRET_KEY=${SECRET}

# Spatial proximity settings (in Minecraft blocks)
MAX_VOICE_DISTANCE=30.0
SNEAK_VOICE_DISTANCE=8.0

# Mediasoup WebRTC Networking
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100
LISTEN_IP=0.0.0.0
ANNOUNCED_IP=${PUBLIC_IP}

# Development join tokens (disabled in production)
ENABLE_DEV_TOKENS=false
EOF
```

> **CRITICAL NOTE**: `ANNOUNCED_IP` must match the **public IPv4 address** of your server reachable from the internet (not `127.0.0.1` or `0.0.0.0`). If misconfigured, remote WebRTC clients will fail during ICE candidate negotiation.

### Step 7: Create the Systemd Service (`voiceengine.service`)
Create `/etc/systemd/system/voiceengine.service`:

```ini
[Unit]
Description=VoiceEngine WebRTC SFU Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/VoiceEngine/voice-server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable voiceengine
sudo systemctl start voiceengine

# Verify service status
sudo systemctl status voiceengine
```

### Step 8: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/voiceengine`:

```nginx
server {
    listen 80;
    server_name voice.yourdomain.com;

    # Logging
    access_log /var/log/nginx/voiceengine_access.log;
    error_log /var/log/nginx/voiceengine_error.log;

    # Proxy to VoiceEngine
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket Upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the virtual host and reload Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/voiceengine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 9: Obtain an SSL Certificate with Certbot
```bash
sudo certbot --nginx -d voice.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
```

### Step 10: Configure Firewall Rules (UFW)
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 25565/tcp
sudo ufw allow 40000:40100/udp
sudo ufw enable
```

### Step 11: Build and Deploy the Paper Plugin
1. Build the plugin JAR:
   ```bash
   cd /opt/VoiceEngine/paper-plugin
   chmod +x gradlew
   ./gradlew build
   ```
2. Copy the artifact `paper-plugin/build/libs/VoiceEngine-paper-1.0.0-SNAPSHOT.jar` into your Paper server's `plugins/` directory.
3. Start or restart your Paper server once to generate `plugins/VoiceEngine/config.yml` (or create it manually) and update the configuration:
   ```yaml
   # Local WebSocket connection to the voice backend
   voice-server-url: "ws://127.0.0.1:3000/ws/plugin"

   # Public HTTPS URL sent to players when running /voice
   web-client-url: "https://voice.yourdomain.com"

   # Secret key (MUST match SECRET_KEY from voice-server/.env exactly)
   secret-key: "<YOUR_SECRET_KEY_FROM_STEP_6>"

   tick-rate-hz: 10
   token-ttl-minutes: 5
   notify-on-join: true
   ```
4. Reload or restart your Paper server (`/reload confirm` or restart).

---

## 5. Troubleshooting & Diagnostics

### 1. Verify Voice Server Health
Execute in your server terminal:
```bash
curl -s http://127.0.0.1:3000/health | jq .
```
You should receive a JSON response similar to:
```json
{
  "status": "ok",
  "service": "voice-server",
  "pluginConnected": true,
  "connectedClients": 0,
  "trackedPlayers": 0,
  "activeTokens": 0
}
```
* If `pluginConnected` is `false`: Verify that `secret-key` in `plugins/VoiceEngine/config.yml` matches `SECRET_KEY` in `voice-server/.env`, and confirm that the Paper server can reach `ws://127.0.0.1:3000/ws/plugin`.

### 2. Browser Blocks Microphone ("Permission Denied")
* Ensure players access the web client via `https://voice.yourdomain.com` and **never** plain `http://...`.
* Verify SSL certificate status:
  ```bash
  sudo certbot certificates
  ```

### 3. Audio Silent or "ICE Connection Failed"
* Check that `ANNOUNCED_IP` in `/opt/VoiceEngine/voice-server/.env` contains the server's public IP address (not `127.0.0.1`).
* Ensure UDP port range `40000-40100` is open in your cloud provider's firewall / security group.

### 4. Real-Time Log Inspection
* **Voice server logs**:
  ```bash
  journalctl -u voiceengine -f -n 100
  ```
* **Nginx error logs**:
  ```bash
  tail -f /var/log/nginx/voiceengine_error.log
  ```
