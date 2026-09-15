# Getting Started with VoiceEngine (Paper)

This guide walks you through installing, configuring, and verifying the **VoiceEngine Paper Plugin** on your Minecraft server.

---

## Prerequisites

Before installing the plugin, ensure your environment meets the following requirements:

- **Server Software**: [Paper](https://papermc.io/), [Purpur](https://purpurmc.org/), or compatible forks running **Minecraft 1.20 through 1.21.x**.
- **Java Runtime**: **Java 21** or higher.
- **VoiceEngine Backend**: A running instance of the VoiceEngine SFU backend (see [Deployment Guide](../../installation/DEPLOY.md)).
- **Web Client**: A hosted VoiceEngine Web Client URL accessible by your players via HTTPS/HTTP.

> [!IMPORTANT]
> The VoiceEngine Paper plugin requires an active WebSocket connection to the VoiceEngine SFU backend. If the backend is unreachable or offline, players will be unable to generate voice session tokens.

---

## Installation Steps

### Step 1: Download & Place the JAR
1. Download `VoiceEngine-paper-1.0.0-SNAPSHOT.jar` from your build output or release page.
2. Place the jar into your Minecraft server's `plugins/` directory:
   ```text
   server-root/
   └── plugins/
       └── VoiceEngine-paper-1.0.0-SNAPSHOT.jar
   ```

### Step 2: Initial Startup
Start your Paper server. On the first startup, VoiceEngine will generate its configuration files and shut down its client until configured:
```text
server-root/
└── plugins/
    └── VoiceEngine/
        ├── config.yml
        ├── speakers.yml
        ├── audio.yml
        └── lang/
            ├── messages_en_US.yml
            └── messages_es_ES.yml
```

### Step 3: Configure Network Secrets
Open `plugins/VoiceEngine/config.yml` in a text editor:

```yaml
# WebSocket URL pointing to your VoiceEngine Node.js backend
voice-server-url: "ws://127.0.0.1:3000/ws/plugin"

# Public URL players use to access the VoiceEngine web interface
web-client-url: "https://voice.yournetwork.com"

# Shared HMAC secret key matching PLUGIN_SECRET in the backend .env
secret-key: "your-secure-random-secret-key-here"

# Server identifier for this world or subserver
server-id: "survival"

# Automatic proxy delegation (recommended: auto)
proxy-mode: "auto"
```

> [!WARNING]
> The `secret-key` must **exactly match** the `PLUGIN_SECRET` configured in your VoiceEngine backend's `.env` file. If they differ, the backend will immediately reject the plugin's authentication handshake with error code `4401`.

### Step 4: Reload or Restart
Apply your configuration changes by executing the reload command in the server console or in-game:
```bash
/voice reload
```
Or restart the server.

---

## Verifying Connectivity

To confirm that the Paper plugin is actively communicating with the backend SFU, execute:

```bash
/voice status
```

### Expected Output

```text
[VoiceEngine] Backend Status:
Status: Connected
Backend URI: ws://127.0.0.1:3000/ws/plugin
Active Tokens: 0
```

If the status displays `Disconnected`, check:
1. Is the backend process running? (Run `pm2 status` or `systemctl status voiceengine`).
2. Can the Paper server reach the backend port? (Test with `nc -zv 127.0.0.1 3000` or PowerShell `Test-NetConnection`).
3. Is `secret-key` identical on both ends?

---

## Player Connection Flow

1. A player joins the server. If `notify-on-join: true`, a clickable chat prompt appears after 2 seconds.
2. The player types:
   ```bash
   /voice
   ```
3. The plugin generates a 6-character short token (valid for 5 minutes), transmits it to the backend via WebSocket, and sends a clickable URL into the player's chat:
   ```text
   Click to connect: https://voice.yournetwork.com/?token=A8K3Z1
   or enter code A8K3Z1 (expires in 5m)
   ```
4. The player opens the browser link and clicks **Connect Audio**. Their microphone input streams directly into the SFU, and spatial positioning updates automatically as they move in-game!
