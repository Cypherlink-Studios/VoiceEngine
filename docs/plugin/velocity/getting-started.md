# Getting Started with VoiceEngine (Velocity)

This guide walks you through deploying the **VoiceEngine Velocity Plugin** on your proxy and coordinating it with your backend Paper servers.

---

## Prerequisites

- **Proxy Software**: [Velocity 3.3.0](https://papermc.io/software/velocity) or higher.
- **Java Runtime**: **Java 21** or higher.
- **Backend SFU**: A running instance of the VoiceEngine SFU backend.
- **Backend Paper Servers**: One or more Paper servers running `VoiceEngine-paper-1.0.0-SNAPSHOT.jar`.

---

## Installation Steps

### Step 1: Install Plugin JAR on Velocity
1. Download `VoiceEngine-velocity-1.0.0-SNAPSHOT.jar`.
2. Place the JAR into your Velocity proxy's `plugins/` directory:
   ```text
   velocity-root/
   └── plugins/
       └── VoiceEngine-velocity-1.0.0-SNAPSHOT.jar
   ```

### Step 2: Configure Velocity Proxy
Start Velocity once to generate the default configuration files:
```text
velocity-root/
└── plugins/
    └── voiceengine-velocity/
        ├── velocity-config.yml
        └── moderation.db
```

Open `plugins/voiceengine-velocity/velocity-config.yml`:

```yaml
# WebSocket URL of the VoiceEngine backend
voice-server-url: "ws://127.0.0.1:3000/ws/plugin"

# Public URL of the Web Client
web-client-url: "https://voice.yournetwork.com"

# Shared secret key matching PLUGIN_SECRET in backend .env
secret-key: "your-secure-random-secret-key-here"

# Token expiration time in minutes
token-ttl-minutes: 5

# Show connection prompt in chat when players join the network
notify-on-join: true
```

### Step 3: Configure Backend Paper Servers
For each Paper server connected to your Velocity network (e.g. `lobby`, `survival`, `minigames`):

1. Ensure `VoiceEngine-paper` is installed in that Paper server's `plugins/` folder.
2. In each Paper server's `plugins/VoiceEngine/config.yml`:
   - Set the same `secret-key` as Velocity.
   - Set `proxy-mode: auto` (or `true`).
   - Assign a unique `server-id` (e.g. `server-id: "lobby"` on the lobby server, `server-id: "survival"` on survival).

```
   [ Velocity Proxy ]  --------> secret-key: "secret123"
           |
           +---> [ Paper: Lobby ]    (server-id: "lobby",    secret-key: "secret123")
           +---> [ Paper: Survival ] (server-id: "survival", secret-key: "secret123")
           +---> [ Paper: Events ]   (server-id: "events",   secret-key: "secret123")
```

---

## Verifying Network Health

### In-Game / Console Check on Velocity
Execute:
```bash
/voice-velocity status
```

### Expected Output
```text
[VoiceEngine] Velocity Proxy Status:
Status: Connected
Backend URI: ws://127.0.0.1:3000/ws/plugin
Active Tokens: 0
```

---

## Testing Seamless Server Switching

1. Log into your Minecraft network via Velocity.
2. Observe the join notification in chat. Click the link or run `/voice`.
3. Open the link in your web browser and click **Connect**.
4. While speaking in voice chat, switch from your `lobby` server to your `survival` server (`/server survival`).
5. Notice that your browser voice session remains completely connected! You will now hear players standing near your position in `survival` without ever needing to re-open the web page.
