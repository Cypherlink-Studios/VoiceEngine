# VoiceEngine — Technical Product Audit & Marketing Readiness Analysis

> **Document Status**: Production Complete  
> **Audited Version**: VoiceEngine v1.0.0-SNAPSHOT  
> **Author**: Senior Technical Product Analyst & Open-Source Maintainer Review  
> **Repository**: [VoiceEngine](https://github.com/Cypherlink-Studios/VoiceEngine)  

---

## 1. Executive Product Summary

**VoiceEngine** is a high-performance, self-hosted 3D spatial proximity voice chat system designed for Minecraft servers running Paper, Purpur, Folia, and Velocity proxy networks.

Its core value proposition is **Zero-Mod, Click-and-Connect Real-Time Audio**: players join a standard vanilla Minecraft Java Edition client, type `/voice` (or click an in-game chat link), and connect instantly through any modern desktop or mobile web browser. No Fabric, Forge, NeoForge, Quilt, or custom client-side JAR installations are required from players.

The system is built on a four-tier distributed architecture:
1. **Minecraft In-Game Orchestration Layer** ([`paper-plugin`](../paper-plugin) and [`velocity-plugin`](../velocity-plugin)): High-frequency telemetry sampling (10–15 Hz), in-game visual speech indicators, physical world speaker blocks, dynamic 3D audio emitters, and a centralized SQLite moderation engine.
2. **Selective Forwarding Unit (SFU) Backend** ([`voice-server`](../voice-server)): Multi-process Mediasoup C++ worker pool routing Opus WebRTC tracks, calculating geometric 3D distance and heading vectors across isolated worlds using an $O(1)$ spatial cell-hash grid with deadband suppression, and serving the client SPA directly.
3. **Web Browser Client** ([`web-client`](../web-client)): Single-page application built on React 19, Vite, and Tailwind CSS. Employs the browser Web Audio API for binaural HRTF spatialization, dynamic atmospheric air absorption filtering, underwater acoustic damping, client-side neural noise suppression (RNNoise WebAssembly AudioWorklet), and hybrid AI Voice Activity Detection (VAD) driven by a background Web Worker.
4. **Operations & Observability Stack** ([`monitoring/`](../monitoring) and [`scripts/`](../scripts)): Automated Prometheus TSDB scraping, pre-provisioned Grafana monitoring dashboards, Discord health webhooks, and an autonomous Ubuntu deployment script with intelligent socket probers.

---

## 2. Actual Capabilities (Verified from Implementation)

The following capabilities are fully verified in source code and operational tests:

* **Zero Client-Side Mods**: Completely transparent to vanilla Minecraft Java Edition players. No local client modifications or installations.
* **Click-and-Connect Authentication**: One-time, cryptographically random 6-character authentication tokens generated in-game with configurable TTL (default 5 minutes), client IP binding, and single-use consumption.
* **3D Binaural Spatial Audio**: Positional audio rendered with Head-Related Transfer Function (`PannerNode.panningModel = 'HRTF'`) with an inverse distance model and 360° directional cones.
* **Atmospheric Air Absorption**: Dynamic logarithmic low-pass cutoff rolloff curve (`calculateAtmosphericCutoff`) modeling physical high-frequency air dampening (20 kHz at $\le 2$m down to 3.5 kHz at $\ge 30$m).
* **Underwater Acoustic Muffling**: 600 Hz low-pass biquad filtering automatically engaged when either the speaker or listener is submerged in water.
* **Sneak Whispering Mechanic**: Players crouching/sneaking (`Shift`) have their audible voice radius automatically compressed from 30 blocks down to 8 blocks.
* **Inter-Dimensional Isolation**: World partition keys (`${serverId}:${world}`) isolate players between dimensions (Overworld, Nether, The End) and multi-server instances.
* **Spectator Mode Mechanics**: Configurable spectator voice routing: `listen-only` (spectators hear alive players; alive players cannot hear spectators), `isolated` (spectators cannot communicate with alive players), and `all` (open communication).
* **Client-Side Neural Noise Suppression**: RNNoise WebAssembly (with runtime SIMD detection) executing inside a dedicated `AudioWorklet` processor (`rnnoise-processor.js`), eliminating background keyboard chatter, fan noise, and room reflections before WebRTC encoding.
* **Microphone DSP & Pre-Processing**: 48 kHz native AudioContext matching Opus clock rate, 80 Hz high-pass rumble filter, soft-knee peak limiter/compressor to prevent clipping, and smooth 15 ms exponential gating envelopes to eliminate digital waveform clicks.
* **Unthrottled Background VAD**: Custom inline Web Worker ticker (25 ms / 40 Hz) driving Voice Activity Detection, completely immune to browser background tab throttling or display repaint freezes when Minecraft is in fullscreen.
* **Physical Speaker Blocks**: World blocks (jukeboxes, note blocks) registered as amplified audio broadcast points with optional Redstone circuit activation and player microphone linking (world megaphone).
* **Dynamic 3D Audio Emitters**: Server-side audio system streaming local files or external media streams with 3D coordinate placement, 2D global broadcasts, real-time volume adjustment, looping, and client-server time sync (`time_sync` clock offset) for lockstep playback.
* **Velocity Proxy Network Persistence**: Top-level proxy gateway where a player runs `/voice` once; switching between backend Paper servers (e.g. Hub $\to$ SMP $\to$ Minigames) preserves the active WebRTC voice session seamlessly.
* **Embedded SQLite Moderation Engine**: High-performance SQLite database (`moderation.db`) in WAL mode on Velocity enforcing temporary or permanent `kick`, `mute`, `deafen`, and `ban` actions with IP-ban evasion prevention and instant SFU synchronization via WebSocket.
* **Live Proximity Radar UI**: Dark-mode canvas radar visualizing nearby players, spatial distance, heading, and animated speaking rings.
* **Document Picture-in-Picture (PiP)**: Always-on-top mini-window floating over Minecraft with live speaking status and global keyboard shortcuts (`M` to mute, `D` to deafen).
* **Mobile QR Companion Mode**: QR code modal allowing players to run VoiceEngine on their smartphone, equipped with the Screen Wake Lock API (`navigator.wakeLock`) to prevent screen sleep.
* **Bilingual Native i18n**: Full internationalization for English (`en`) and Spanish (`es`) with zero third-party dependencies, accessible via an in-app language switcher.
* **Admin Web Portal**: Protected staff portal accessed via `/voice admin` enabling real-time branding customization (server name, theme colors, logos), fixed voice channel management, backend tuning, and a live client monitor.
* **Production Observability**: Prometheus scraping endpoint (`GET /metrics`), turnkey Grafana dashboard (`voiceengine-overview.json`), Discord lag/CPU watchdog alerts, and non-interactive Ubuntu installation scripts with port conflict auto-resolution.

---

## 3. Target Audience Matrix

| Target Audience | Primary Problem Solved | Key Features of Interest | Value Assessment |
| :--- | :--- | :--- | :--- |
| **Survival & SMP Communities** | Modpack friction: Casual players refuse to install Fabric/Simple Voice Chat or struggle with JAR versions. | Zero client mods, click-and-connect, sneak whispering, underwater acoustics. | **Very High**: Lowest possible barrier to entry for community-wide voice adoption. |
| **Roleplay & CityBuild Servers** | Immersion breaking: Global Discord calls destroy spatial realism and roleplay boundaries. | Binaural HRTF, speaker blocks (megaphones), fixed radio channels with proximity ducking, dimension isolation. | **Exceptional**: Physical world speaker blocks and radio ducking provide unmatched RP tools. |
| **Horror & Adventure Servers** | Immersion & sound design: Lack of directional audio and acoustic environmental awareness. | Atmospheric rolloff, underwater damping, 3D audio emitters for ambient stingers/cues, spectator listen-only mode. | **Exceptional**: Ability to trigger synchronized 3D spatial sounds at exact coordinates enhances map design. |
| **Large Networks & Minigame Hubs** | Fragmented calls & server-switching disconnects: Players get disconnected from voice when hopping servers. | Velocity proxy integration, seamless server-switching persistence, multi-worker SFU, SQLite moderation. | **High**: Solves network-wide continuity without requiring players to reconnect web sessions. |
| **Server Owners & Sysadmins** | Complex WebRTC setups: Hard-to-deploy SFUs with port forwarding confusion and lack of metrics. | Turnkey Ubuntu installer (`install.sh`), Prometheus/Grafana stack, Pterodactyl port auto-resolution. | **High**: Greatly simplifies WebRTC deployment on standard Linux VPS infrastructure. |
| **Minecraft Plugin Developers** | Closed voice ecosystems: Inability to hook into voice events or manipulate audio programmatically. | Bukkit `ServicesManager` (`VoiceEngineAPI`), custom event bus (`PlayerSpeakingStateChangeEvent`), REST/WS APIs. | **Moderate to High**: Clear, idiomatic Java API for custom game mechanics. |
| **Minecraft Players** | Clunky third-party software: Needing to configure Discord overlays, open extra desktop apps, or share personal accounts. | In-game `/voice` command, PiP floating overlay, mobile QR companion, per-player volume popovers. | **High**: Zero installation; privacy-friendly since no personal Discord or third-party accounts are exposed. |

---

## 4. User Experience Analysis

### 4.1 Player Journey (Desktop)
1. **Discovery**: Upon entering the Minecraft server, the player receives a welcome message in chat with an interactive button (or runs `/voice`).
2. **One-Click Link**: Clicking the chat prompt generates a secure link: `https://voice.yourdomain.com/?token=ABC123`.
3. **Browser Onboarding**: The link opens the browser client. The single-use token is automatically extracted from the URL.
4. **Hardware Permission**: The player clicks **"Connect Voice"**. The browser requests standard microphone permissions.
5. **Real-Time Feedback**: Sound effects play (`connect.mp3`), the live radar populates, and speaking note particles appear above the player's head in Minecraft when talking.
6. **Background Operation**: The player alt-tabs back to Minecraft. The background Web Worker ensures voice transmission continues without stutter. The player can activate Picture-in-Picture (PiP) to keep a mini-radar overlay visible over Minecraft.

### 4.2 Player Journey (Mobile Companion)
1. Player runs `/voice` and opens the web client on desktop or clicks the **QR Companion** icon.
2. Player scans the QR code with their smartphone.
3. Mobile browser loads the client, requests mic permissions, and acquires a Screen Wake Lock so the phone screen stays active on a desk.
4. Audio streams smoothly while freeing up desktop CPU and screen real estate.

### 4.3 Friction Points Identified
* **Mandatory HTTPS**: Outside of `localhost`, modern browsers strictly deny microphone access over unencrypted HTTP. If an administrator fails to configure SSL/TLS certificates, players receive an immediate browser permission denial.
* **URL Pop-up Handling**: Some vanilla Minecraft clients show a warning modal when clicking chat URLs ("Are you sure you want to open this link?"). While standard Minecraft behavior, it is an extra click.
* **Mobile Screen Backgrounding**: iOS Safari and mobile Chrome may suspend audio capture if the browser is minimized or switched to another app, making the Screen Wake Lock feature essential.

---

## 5. Server Administrator Experience

### 5.1 Deployment & Maintenance
* **Automated Script Deployment**: `scripts/install.sh` on Ubuntu 22.04/24.04 LTS configures the entire stack (Node.js 20, Java 21, Nginx, Certbot SSL, systemd service, UFW firewall) interactively or unattended with `-y`.
* **Conflict Resolution**: Deployment scripts feature multi-tool socket inspection (`ss`, `lsof`, `netstat`, `/dev/tcp`) that detects port conflicts (common on Pterodactyl/Wings environments) and auto-reallocates to free ports.
* **Process Management**: Voice server runs as a standard `systemd` service (`voiceengine.service`) with auto-restart, high file-descriptor limits (`LimitNOFILE=65536`), and graceful shutdown hooks.

### 5.2 Required Network Topology & Firewalls

| Port / Protocol | Service | Public Access | Purpose |
| :--- | :--- | :--- | :--- |
| **80 / TCP** | HTTP / Nginx | Public | Certbot Let's Encrypt validation and HTTP-to-HTTPS redirect |
| **443 / TCP** | HTTPS / WSS | Public | Web client SPA delivery and secure WebSocket signaling |
| **25565 / TCP** | Minecraft | Public | Standard Minecraft player connections |
| **40000–49999 / UDP** | Mediasoup WebRTC | **Public (Direct)** | RTP / RTCP media packets for peer voice tracks |
| **3000 / TCP** | Voice Server | Localhost only | Internal Node.js API and WebSocket backend |

> [!IMPORTANT]
> **Firewall Warning for Cloud Providers**: Ports `40000-49999 UDP` MUST be opened directly in cloud provider security lists (AWS Security Groups, Oracle Cloud VCN, Google Cloud VPC, Hetzner Firewall) and cannot be routed through a standard HTTP reverse proxy (such as Cloudflare CDN or standard Nginx). `ANNOUNCED_IP` must match the server's public IPv4 address.

---

## 6. Developer Experience

### 6.1 Bukkit / Paper ServicesManager API
The Paper plugin registers `VoiceEngineAPI` directly into Bukkit's `ServicesManager`:
```java
VoiceEngineAPI api = Bukkit.getServicesManager().load(VoiceEngineAPI.class);
if (api != null) {
    boolean connected = api.isPlayerConnected(player.getUniqueId());
    api.playSpatialAudio("stinger-1", "custom/sound.ogg", location, 25.0);
}
```

### 6.2 Custom Event Bus
Third-party plugins can listen to custom asynchronous Bukkit events:
* `PlayerVoiceConnectedEvent`: Fired when a player authenticates their browser session.
* `PlayerVoiceDisconnectedEvent`: Fired when a session terminates.
* `PlayerSpeakingStateChangeEvent`: Fired in real-time when voice activity starts or stops.

### 6.3 Standalone Mock Testing Harness
Developers can test the full 3D spatial web client without running a Minecraft server:
* `npm run dev` in `voice-server`
* `npm run mock` in `voice-server`
* Connects 4 synthetic bot players orbiting in real-time (`STEVE1`, `ALEX01`, `SUBM01`, `NINJA1`) with preset submersion and sneaking states.

---

## 7. Technical Differentiators

```
┌────────────────────────────────────────────────────────────────────────┐
│               VOICEENGINE TECHNICAL DIFFERENTIATORS                   │
└────────────────────────────────────────────────────────────────────────┘
  1. 3D Spatial Grid Engine      O(1) Cell Hashing + O(N·k) 27-Cell Pruning
  2. Binary Telemetry Codec      25-Byte ArrayBuffer Batches (~79% BW Cut)
  3. Multi-Worker SFU Pool       C++ Core Distribution via PipeTransports
  4. Background Web Worker VAD   Immune to Fullscreen Browser Throttling
  5. Neural Noise Suppression    Local Client-Side RNNoise WASM / SIMD
  6. Acoustic Physical Modeling  Dynamic Atmospheric Rolloff + Water Damping
  7. Velocity Session Gateway    Cross-Server Hop Persistence + SQLite WAL
```

1. **3D Spatial Grid Hashing ($O(N \cdot k)$)**: Naive Euclidean distance checks scale as $O(N^2)$, which stutters above 200 players. VoiceEngine divides worlds into 32-block cubic cells using integer bitwise numeric keys (zero heap string allocations) and queries only the 27 neighboring cells, achieving a $6.8\times$ computational speedup at 800 players.
2. **Compact Binary ArrayBuffer Telemetry**: High-rate 10 Hz coordinate streaming is packed into a 25-byte Little-Endian binary structure per peer, reducing JSON payload overhead from ~1,200 bytes down to 253 bytes for 10 peers (~79% bandwidth savings).
3. **Multi-Worker Mediasoup SFU with PipeTransports**: Distributes WebRTC tracks evenly across CPU cores (`MEDIASOUP_NUM_WORKERS`) and establishes dynamic inter-worker `PipeTransport` routing when speakers and listeners are assigned to different worker threads.
4. **Web Worker Background Timer**: Chromium and Safari aggressively throttle background tab timers (`setInterval`) down to 1 Hz or freeze them during fullscreen gaming. VoiceEngine offloads VAD ticks to an inline Web Worker, guaranteeing uninterrupted 40 Hz processing.
5. **Client-Side Neural Noise Suppression (RNNoise)**: Background filtering executes entirely in the player's browser using WebAssembly with SIMD detection, ensuring crystal-clear microphone audio without burdening the server CPU with audio processing.
6. **Physical Atmospheric & Environmental Acoustics**: Rather than a simple volume cutoff, audio high frequencies dynamically attenuate over distance via an exponential rolloff curve (`calculateAtmosphericCutoff`), paired with an immediate 600 Hz low-pass filter underwater.

---

## 8. Adoption Barriers & Trust Analysis

### 8.1 Trust & Privacy Questions (Answered from Code)

* **Where does voice data travel?** Audio travels directly from the player's browser to the self-hosted `voice-server` via encrypted WebRTC (DTLS-SRTP). It never touches third-party clouds or external voice APIs.
* **Is audio stored or recorded?** No. The server operates strictly as a real-time Selective Forwarding Unit (SFU). Voice packets are forwarded directly between peer WebRTC tracks in memory; audio is never recorded, buffered, or written to disk.
* **Can it be completely self-hosted?** Yes. All components (`voice-server`, `web-client`, `paper-plugin`, `velocity-plugin`) are 100% open source under the MIT License and run on self-managed infrastructure.
* **What data is persisted on disk?**
  * Minecraft UUID, username, and IP address are stored temporarily in memory for session validation.
  * Sanctions (bans, mutes, deafens) are stored locally in the server's SQLite database (`moderation.db`).
  * Player UI volume preferences are stored exclusively on the player's machine in browser `localStorage`.
* **Are external accounts required?** No. No Discord, Microsoft OAuth, or email registration is required. Authentication is handled entirely by in-game Minecraft permissions.

### 8.2 Primary Adoption Barriers
1. **HTTPS / Domain Requirement**: Many hobbyist server owners run on raw numeric IPs without domains or SSL certificates. VoiceEngine cannot operate its microphone pipeline over plain HTTP due to browser security policies.
2. **UDP Port Forwarding**: Users hosting on budget Minecraft hosts (shared Game Server providers with single port allocations) cannot open the UDP port range `40000-49999`. VoiceEngine requires a VPS, dedicated server, or host with customizable port ranges.
3. **Browser Audio Permissions**: Players must click "Allow" on the microphone prompt on first visit.

---

## 9. Marketing Opportunities & Positioning

### 9.1 Strongest Positioning Angles
1. **"Proximity Voice Chat with Zero Client Mods"**: The single biggest competitive advantage over Fabric/Forge voice mods (e.g., Simple Voice Chat). Any player with a vanilla Minecraft client can participate instantly.
2. **"Studio-Grade Voice Processing in Your Browser"**: Highlight RNNoise neural noise suppression, 80 Hz rumble filtering, and soft-knee limiters. Players get crisp voice quality without background keyboard clatter.
3. **"Network-Wide Voice Continuity"**: For Velocity networks, emphasize that hopping between lobbies, survival, and minigames never drops the call.
4. **"World Megaphones & Redstone Speaker Blocks"**: Showcase physical in-game sound propagation, jukebox audio transmitters, and Redstone integration.

### 9.2 Recommended Growth Vectors
* **Showcase Videos / Short-Form Clips**: Side-by-side clips showing a player crouching to whisper, diving underwater to muffle sound, or wiring up a Redstone speaker block.
* **Community Server Showcase**: Partner with an active SMP or roleplay server to capture authentic player reactions during a launch event.
* **Plugin Developer Integrations**: Highlight the `VoiceEngineAPI` Bukkit service to encourage minigame creators to build custom proximity mechanics.

---

## 10. Repository Quality Assessment

| Dimension | Rating | Findings |
| :--- | :---: | :--- |
| **Code Architecture** | **A** | Excellent modular separation across `paper-plugin`, `velocity-plugin`, `voice-server`, and `web-client`. Clean design patterns (Cloud commands, Mediasoup PipeTransports, Web Audio graphs). |
| **Test Coverage** | **A-** | 109 automated tests passing across 23 test files in `voice-server`. Robust JUnit test suites in both `paper-plugin` and `velocity-plugin`. |
| **Documentation Depth** | **B+** | Detailed sub-guides exist in `docs/plugin/` and `docs/architecture/`, but root `README.md` was out of date and omitted Velocity. |
| **Deployment Automation** | **A-** | Comprehensive bash scripts (`install.sh`, `prometheus_integration.sh`) with socket probing. Minor gap: Velocity is not built inside `install.sh`. |
| **Web Client Code Quality** | **A** | React 19, strict TypeScript, Tailwind CSS, native i18n, Web Worker timers, resilient WebRTC handling. |
