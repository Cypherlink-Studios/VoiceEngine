# VoiceEngine

> **Browser-based 3D proximity voice chat for Minecraft Paper servers and Velocity networks — no client-side Minecraft mod required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Java 17 / 21](https://img.shields.io/badge/Java-17%20%7C%2021-ED8B00?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Node.js 20+ LTS](https://img.shields.io/badge/Node.js-20%2B%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PaperMC 1.20.4+](https://img.shields.io/badge/PaperMC-1.20.4%2B-red)](https://papermc.io)
[![Velocity 3.4.0+](https://img.shields.io/badge/Velocity-3.4.0%2B-00B4D8)](https://papermc.io/software/velocity)
[![WebRTC Mediasoup](https://img.shields.io/badge/WebRTC-Mediasoup%20SFU-green)](https://mediasoup.org)

---

## 💡 Why VoiceEngine?

Traditional Minecraft proximity voice chat solutions require every player to install a custom client-side mod loader (such as Fabric, Forge, or NeoForge) along with specific mod JAR files. This creates friction that fragments communities: casual players struggle to install mods, game updates break client compatibility, and mobile or console crossplay users are left out completely.

**VoiceEngine eliminates client-side mod requirements entirely.**

Players join your Minecraft server using standard vanilla Minecraft Java Edition, type `/voice` in chat, and click a secure connection link. The link opens a high-performance web client in their browser (desktop or mobile) powered by the **Web Audio API** and a **WebRTC Selective Forwarding Unit (SFU)**. 

Players enjoy rich 3D spatialized binaural audio, client-side neural noise suppression, acoustic environmental damping, and physical world speaker blocks — all without installing a single local modification.

---

## ✨ Features

### 🎧 Core Audio & Spatial Immersion
* **Zero Client Mods Required**: Pure vanilla Minecraft Java Edition compatibility. Players connect through modern desktop or mobile browsers.
* **3D Binaural Spatial Audio**: Positional audio rendered with Head-Related Transfer Function (`HRTF`) via the browser's native Web Audio API.
* **Atmospheric Air Absorption**: Dynamic logarithmic frequency rolloff (`calculateAtmosphericCutoff`) modeling physical high-frequency air dampening from 20 kHz down to 3.5 kHz over distance.
* **Underwater Acoustic Damping**: Automatic 600 Hz low-pass biquad filter applied when either player is submerged in water.
* **Sneak Whispering**: Crouching (`Shift`) automatically compresses the audible speech radius from 30 blocks down to 8 blocks.
* **Inter-Dimensional Isolation**: Nether, End, and Overworld audio remain strictly isolated into separate world partitions.
* **Spectator Voice Modes**: Configurable spectator behavior (`listen-only`, `isolated`, or `all`) for minigames, events, and tournaments.

### 🎙️ Studio-Grade Microphone DSP & Processing
* **Client-Side Neural Noise Suppression (RNNoise)**: WebAssembly AudioWorklet (with SIMD detection) removes background keyboard chatter, fan noise, and room reflections before sending audio.
* **80 Hz High-Pass Filter**: Strips sub-bass desk vibrations, air conditioning hum, and breath pops.
* **Soft-Knee Peak Compressor & Limiter**: Automatically controls sudden volume peaks to prevent digital clipping and audio distortion.
* **Smooth Exponential Gate Envelope**: ~15 ms smooth attack and release envelope eliminates abrupt clicks and pops.
* **Unthrottled Background VAD**: Dedicated inline Web Worker timer (40 Hz) driving Voice Activity Detection, completely immune to browser background tab throttling when Minecraft is in fullscreen.
* **Microphone Loopback Test**: Built-in self-monitoring mode with an 180 ms delay for real-time calibration.

### 🧱 In-Game World Mechanics & Media Emitters
* **Visual Speech Particles**: Subtle musical note particles appear above speaking players' heads in Minecraft. Muted players are automatically suppressed from emitting particles.
* **Physical Speaker Blocks**: Register world blocks (such as jukeboxes) as amplified audio broadcast points with customizable radii.
* **Redstone Speaker Megaphones**: Turn speaker blocks on or off using Redstone signals, or link a player's microphone to broadcast their voice across a region.
* **Dynamic 3D Audio Emitters**: Play localized spatial music tracks, environmental soundscapes, or 2D global broadcasts directly via in-game commands.
* **Synchronized Playback**: Client-server clock synchronization ensures players walking into an audio emitter's radius hear the audio in lockstep.
* **Remote Media Caching**: Automated downloading and LRU caching for external audio tracks and streams (`yt-dlp` / `ffmpeg`).

### 🌐 Network, Proxy & Administration
* **Velocity Proxy Support**: Centralized proxy gateway. Players authenticate once upon joining the network; switching between backend Paper servers preserves the active voice call.
* **Embedded SQLite Moderation Engine**: High-performance local SQLite database (`moderation.db`) in WAL mode enforcing network-wide `kick`, `mute`, `deafen`, and `ban` actions with IP-ban evasion prevention.
* **Instant SFU Synchronization**: Sanctions applied by staff push immediately via WebSocket, muting or disconnecting the offender's browser in milliseconds.
* **Live Proximity Radar UI**: Clean dark-mode canvas radar visualizing nearby players, spatial distance, heading, and animated speaking rings.
* **Document Picture-in-Picture (PiP)**: Native floating HUD pinned over Minecraft with live speaking indicators and `M` (Mute) / `D` (Deafen) keyboard shortcuts.
* **Mobile QR Companion Mode**: Scan a QR code to run VoiceEngine on a smartphone, complete with the Screen Wake Lock API to keep the display active on your desk.
* **Bilingual Native Localization**: Native English (`en`) and Spanish (`es`) interfaces with zero third-party dependencies.
* **Admin Web Portal**: Staff dashboard accessed via `/voice admin` enabling real-time branding customization (server name, theme colors, logos), fixed voice channels, and live client monitoring.
* **Production Observability**: Prometheus scraping endpoint (`GET /metrics`), turnkey Grafana dashboard, Discord operational health webhooks, and an Ubuntu installation script with port collision auto-resolution.

---

## 🏗️ How It Works

```
┌─────────────────────────────────┐
│  Minecraft Players (Vanilla)    │
└────────────────┬────────────────┘
                 │ Minecraft Network Protocol
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MINECRAFT SERVER LAYER                    │
│                                                                 │
│   ┌─────────────────────────────┐   ┌────────────────────────┐  │
│   │   Velocity Proxy Plugin     │   │      Paper Plugin      │  │
│   │   - Network-wide /voice     │   │   - 10-15 Hz Telemetry │  │
│   │   - SQLite Moderation Engine│   │   - Speaker Blocks     │  │
│   │   - Server switch routing   │   │   - 3D Audio Emitters  │  │
│   └──────────────┬──────────────┘   │   - Bukkit Event Bus   │  │
│                  │                  └───────────┬────────────┘  │
└──────────────────┼──────────────────────────────┼───────────────┘
                   │                              │
                   │ WebSocket Control & Telemetry│
                   ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│             VOICE BACKEND & SFU (voice-server :3000)            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ 3D Spatial Grid Engine (O(N·k) 32-block Cell Hashing)   │   │
│   └────────────────────────────┬────────────────────────────┘   │
│                                │                                │
│   ┌────────────────────────────▼────────────────────────────┐   │
│   │ Mediasoup C++ Multi-Worker SFU Pool (UDP 40000-49999)   │   │
│   │ Worker 0 ◄──── dynamic PipeTransports ────► Worker 1     │   │
│   └────────────────────────────┬────────────────────────────┘   │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                   WebRTC Media  │  WebSocket Signaling
                   (Opus Audio)  │  (ArrayBuffer Binary)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT (web-client)                   │
│                                                                 │
│   ┌───────────────────────────┐   ┌─────────────────────────┐   │
│   │ Microphone Pipeline       │   │ Spatial Audio Pipeline  │   │
│   │ - RNNoise WASM / SIMD     │   │ - Web Audio HRTF Panner │   │
│   │ - 80 Hz High-Pass Filter  │   │ - Atmospheric Rolloff   │   │
│   │ - Background Web Worker   │   │ - Underwater Low-Pass   │   │
│   │ - Peak Limiter            │   │ - Radio Ducking         │   │
│   └───────────────────────────┘   └─────────────────────────┘   │
│                                                                 │
│   UI Features: Live Radar • PiP Overlay • Mobile QR Companion   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎮 Player Experience

Connecting to VoiceEngine takes seconds:

```
1. Join Server       2. Run /voice        3. Open Link         4. Talk
 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │ Log into the │ ──► │ Type /voice  │ ──► │ Click prompt │ ──► │ Allow mic    │
 │ Paper/Proxy  │     │ or click join│     │ to open web  │     │ and explore  │
 │ Minecraft sv │     │ notice       │     │ client       │     │ in 3D audio  │
 └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Join the Minecraft server**: Connect with any vanilla Minecraft Java Edition client.
2. **Type `/voice`**: You receive a clickable in-game message containing a secure, short-lived authentication token.
3. **Open the browser client**: Click the link to open `https://voice.yourdomain.com/?token=...`.
4. **Allow microphone access**: Click **"Connect Voice"** and allow microphone permissions in your browser.
5. **Start talking**: Alt-tab back to Minecraft! Voice chat runs seamlessly in the background with spatial audio, live radar, and speaking note particles.

---

## 📦 Repository Structure

```
VoiceEngine/
├── paper-plugin/       # Paper Minecraft Plugin (Java 17+, Cloud Commands, Spatial Telemetry)
├── velocity-plugin/    # Velocity Proxy Plugin (Java 21+, Network Persistence, SQLite Moderation)
├── voice-server/       # WebRTC SFU & Signaling Backend (TypeScript, Node.js 20+, Mediasoup)
├── web-client/         # Web Application (Vite, React 19, Tailwind CSS, Web Audio API)
├── monitoring/         # Turnkey Prometheus & Grafana Configuration and Dashboards
├── scripts/            # Deployment Automation (install.sh, prometheus_integration.sh)
├── docs/               # Architecture, Deployment, Moderation, and Plugin Guides
└── openspec/           # OpenSpec Change Management & Specifications
```

---

## 🚀 Quick Start (Development & Local Testing)

### 1. Prerequisites
* **Java**: OpenJDK 17 or 21 (Java 21 required for Velocity)
* **Node.js**: v20.x or higher and `npm`

### 2. Voice Server (Node.js & Mediasoup)
```bash
cd voice-server
npm install
npm run build
npm start
```

### 3. Web Client (Vite + React)
```bash
cd web-client
npm install
npm run build   # Compiles production assets into dist/
npm run dev     # Starts development server on http://localhost:5173
```

### 4. Minecraft Plugins (Paper & Velocity)
* **Build Paper Plugin**:
  ```bash
  cd paper-plugin
  ./gradlew build
  # Artifact: paper-plugin/build/libs/VoiceEngine-paper-1.0.0-SNAPSHOT.jar
  ```
* **Build Velocity Plugin**:
  ```bash
  cd velocity-plugin
  ./gradlew build
  # Artifact: velocity-plugin/build/libs/VoiceEngine-velocity-1.0.0-SNAPSHOT.jar
  ```

---

## 🧪 Testing Without Minecraft (Mock Telemetry Simulator)

You can test the complete 3D proximity voice experience and live radar without booting a Minecraft server:

1. **Start the Voice Server in development mode**:
   ```bash
   cd voice-server
   npm run dev
   ```
2. **Launch the mock telemetry simulator in a separate terminal**:
   ```bash
   cd voice-server
   npm run mock
   ```
   This spawns 4 virtual players orbiting in real-time with pre-registered test codes:
   * `STEVE1` (Steve — Overworld surface)
   * `ALEX01` (Alex — Orbiting peer)
   * `SUBM01` (Submariner — Submerged in water, testing 600 Hz low-pass filter)
   * `NINJA1` (Ninja — Crouched, testing sneak whispering radius)
3. **Connect in your browser**:
   Open `http://localhost:3000/?token=STEVE1`, click **"Connect Voice"**, and watch the live radar track nearby players in 3D space!

---

## 🛠️ Production Deployment

### Option A: Automated Ubuntu Deployment (Recommended)
VoiceEngine provides an autonomous installation script for **Ubuntu 22.04 / 24.04 LTS** that installs dependencies, builds all projects, configures systemd, provisions Nginx, and secures free SSL certificates:

```bash
git clone https://github.com/Cypherlink-Studios/VoiceEngine.git /opt/VoiceEngine
cd /opt/VoiceEngine
chmod +x scripts/install.sh
sudo bash scripts/install.sh
```

The script features interactive port inspection that detects port collisions (common on Pterodactyl and multi-tenant hosts) and automatically reallocates conflicting sockets.

### Option B: Manual Production Setup

1. **Deploy Web Client & Voice Server**:
   ```bash
   cd /opt/VoiceEngine/web-client && npm install && npm run build
   cd /opt/VoiceEngine/voice-server && npm install && npm run build
   ```
2. **Configure Environment Variables** in `/opt/VoiceEngine/voice-server/.env`:
   ```env
   PORT=3000
   HOST=0.0.0.0
   NODE_ENV=production
   SECRET_KEY=generate-a-secure-random-secret
   ANNOUNCED_IP=YOUR_SERVER_PUBLIC_IPV4
   LISTEN_IP=0.0.0.0
   MEDIASOUP_NUM_WORKERS=2
   RTC_MIN_PORT=40000
   RTC_MAX_PORT=49999
   ```
3. **Configure Systemd**:
   Run the voice server under `systemd` (`/etc/systemd/system/voiceengine.service`).
4. **Set Up Nginx with SSL/TLS**:
   Terminate HTTPS/WSS on port 443 and proxy traffic to `http://127.0.0.1:3000`.
5. **Deploy the Plugin**:
   Copy `VoiceEngine-paper-1.0.0-SNAPSHOT.jar` to your Paper server's `plugins/` directory and update `plugins/VoiceEngine/config.yml`.

For complete step-by-step instructions, see the [Production Deployment Guide](docs/installation/DEPLOY.md).

---

## 🔒 Required Network Ports & HTTPS Policy

| Port / Protocol | Service | Public Exposure | Purpose |
| :--- | :--- | :--- | :--- |
| **80 / TCP** | HTTP | Public | Certbot Let's Encrypt validation & HTTP redirect |
| **443 / TCP** | HTTPS / WSS | Public | Web Client SPA and secure WebSocket signaling |
| **25565 / TCP** | Minecraft | Public | Paper / Velocity Minecraft server port |
| **40000–49999 / UDP** | Mediasoup WebRTC | **Public (Direct)** | RTP / RTCP media packets for peer voice tracks |
| **3000 / TCP** | Voice Server | Localhost only | Internal Node.js API and WebSocket backend |

> [!CRITICAL]
> **HTTPS Requirement**: Modern web browsers strictly forbid microphone access (`navigator.mediaDevices.getUserMedia`) over unencrypted HTTP outside of `localhost`. An active SSL certificate (HTTPS/WSS) is mandatory for production use.
>
> **Cloud Firewall Rule**: Ports `40000-49999 UDP` must be opened directly in your cloud firewall or security group (AWS, Oracle Cloud, GCP, Hetzner) and cannot be routed through a standard HTTP proxy. Set `ANNOUNCED_IP` to your server's public IPv4 address.

---

## ⚙️ Configuration Reference

### Paper Plugin (`plugins/VoiceEngine/config.yml`)
```yaml
# Connection to the VoiceEngine backend
voice-server-url: "ws://127.0.0.1:3000/ws/plugin"

# Public HTTPS URL sent to players in /voice
web-client-url: "https://voice.yourdomain.com"

# Shared secret key (must match SECRET_KEY in voice-server/.env)
secret-key: "your-secure-secret"

# Telemetry frequency in Hz (10 to 15 recommended)
tick-rate-hz: 10

# Token expiration in minutes
token-ttl-minutes: 5

# Gameplay mechanics
mechanics:
  whisper-on-sneak: true
  underwater-acoustics: true
  speaking-particles: true
  spectator-mode: "listen-only"

# Physical speaker blocks & audio emitters
speakers:
  enabled: true
  particles-enabled: true

audio:
  enabled: true
  persistence-enabled: true
  particles-enabled: true
```

### Velocity Proxy (`plugins/VoiceEngine/velocity-config.yml`)
```yaml
voice-server-url: "ws://127.0.0.1:3000/ws/plugin"
web-client-url: "https://voice.yourdomain.com"
secret-key: "your-secure-secret"
token-ttl-minutes: 5
notify-on-join: true
join-message: "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Proximity voice is active! Type <click:run_command:'/voice'><yellow>/voice</yellow></click> to connect.</gray>"
```

---

## 📊 Observability & Metrics

VoiceEngine exposes standard Prometheus metrics at `GET /metrics` on port 3000. An automated integration script (`scripts/prometheus_integration.sh`) provisions Prometheus and a pre-built Grafana dashboard:

```bash
sudo bash scripts/prometheus_integration.sh
```

* **Grafana Dashboard**: Auto-loads [`voiceengine-overview.json`](monitoring/grafana/dashboards/voiceengine-overview.json) featuring:
  * Real-time authenticated client counts.
  * Node.js Event Loop Lag gauges with alert thresholds.
  * Mediasoup C++ worker distribution and PipeTransport allocations.
  * Spatial calculation duration percentiles ($P_{50}$, $P_{95}$).
  * Deadband bandwidth suppression ratios (~79% savings).
* **Discord Health Alerts**: Set `DISCORD_WEBHOOK_URL` in `.env` to receive immediate alerts if event loop lag exceeds 30 ms or worker CPU exceeds 85%.

For complete details, see the [Prometheus & Grafana Observability Guide](docs/observability/PROMETHEUS_GRAFANA.md).

---

## 🛡️ Security & Privacy

* **Zero Voice Recording**: VoiceEngine operates strictly as a real-time Selective Forwarding Unit (SFU). Voice packets are forwarded directly in memory between active WebRTC tracks; audio is never recorded, buffered to disk, or transcribed.
* **Encrypted Transport**: All audio streams use standard WebRTC encryption (**DTLS-SRTP**). Signaling uses secure WebSockets (**WSS**).
* **Single-Use Ephemeral Tokens**: `/voice` connection tokens expire after 5 minutes, are bound to client IP addresses to prevent token-sniffing, and are invalidated immediately upon consumption.
* **No Third-Party Accounts**: Zero Discord, Microsoft OAuth, or email credentials are required from players. Authentication is derived strictly from in-game Minecraft sessions.
* **Local Data Persistence**: Player audio settings (volume overrides, local mutes) are stored exclusively in the player's own browser `localStorage`.

---

## 📚 Documentation Index

* **Architecture & Scalability**: [High-concurrency design, spatial grid hashing, and multi-worker SFU](docs/architecture/ARCHITECTURE.md)
* **Production Deployment**: [Ubuntu 22.04/24.04 manual and automated deployment guide](docs/installation/DEPLOY.md)
* **Observability Guide**: [Prometheus and Grafana setup, metrics reference, and Discord alerts](docs/observability/PROMETHEUS_GRAFANA.md)
* **Paper Plugin User Guide**: [Commands, permissions, speaker blocks, and developer API](docs/plugin/paper/README.md)
* **Velocity Proxy User Guide**: [Proxy topology, server switching, and SQLite moderation](docs/plugin/velocity/README.md)
* **Product & Technical Audit**: [Full product audit, audience matrix, and trust analysis](docs/.internal/product-audit.md)
* **Feature Inventory**: [Complete verified implementation matrix](docs/.internal/feature-inventory.md)
* **Product Issues & Roadmap**: [Maintainer decisions and backlog items](docs/.internal/product-issues.md)
* **Marketing Asset Guide**: [Visual and media capture specifications](docs/.internal/marketing-assets.md)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Verify tests pass across all subprojects:
   * `cd voice-server && npm test`
   * `cd web-client && npm run build`
   * `cd paper-plugin && ./gradlew test`
   * `cd velocity-plugin && ./gradlew test`
4. Commit your changes (`git commit -m 'feat: add amazing feature'`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
