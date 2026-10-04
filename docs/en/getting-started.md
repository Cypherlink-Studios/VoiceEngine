---
title: Getting Started with VoiceEngine
description: Step-by-step installation and deployment guide for VoiceEngine on Paper servers and Velocity networks.
sidebar:
  order: 2
---

This guide provides step-by-step instructions for deploying **VoiceEngine** on your Minecraft server infrastructure.

---

## Prerequisites

- **Java Runtime**: Java 17 or Java 21 (recommended).
- **Minecraft Server**: Paper or Purpur 1.20.4 or higher (tested on 1.20.6 and 1.21.x).
- **Proxy Network (Optional)**: Velocity 3.4.0 or higher.
- **Voice Server (SFU)**: Linux/Docker server running Node.js 20+ LTS with open UDP ports for WebRTC traffic.
- **SSL/TLS Certificates**: A valid public domain with HTTPS and WSS configured to permit browser microphone access.

:::caution
Modern web browsers (Chrome, Firefox, Safari, Edge) block microphone permissions on insecure HTTP origins (except `localhost`). For production servers, your web frontend must be served over HTTPS.
:::

---

## Scenario A: Standalone Server (Paper)

If you are running a single Paper server without a proxy:

### 1. Plugin Installation
Download `VoiceEngine-paper.jar` and place it in your Paper server's `plugins/` directory.

### 2. Generate Configuration
Start the server once to generate the default configuration in `plugins/VoiceEngine/config.yml`:

```yaml
voice-server-url: "wss://voice.yourdomain.com/ws/plugin"
web-client-url: "https://voice.yourdomain.com"
secret-key: "generate-a-secure-random-secret"
tick-rate-hz: 10
proxy-mode: "false"
```

### 3. Apply Configuration
Reload or restart the server. You can also run `/voice reload` to reload configuration on the fly.

---

## Scenario B: Proxy Network (Velocity)

For networks utilizing a Velocity proxy gateway:

### 1. Velocity Proxy Setup
Place `VoiceEngine-velocity.jar` into your Velocity proxy's `plugins/` directory. Start Velocity to generate `plugins/voiceengine-velocity/velocity-config.yml`:

```yaml
voice-server-url: "wss://voice.yourdomain.com/ws/plugin"
web-client-url: "https://voice.yourdomain.com"
secret-key: "generate-a-secure-random-secret"
token-ttl-minutes: 5
notify-on-join: true
```

### 2. Backend Paper Nodes Setup
Place `VoiceEngine-paper.jar` into each backend Paper server's `plugins/` directory (Lobby, Survival, Minigames, etc.). Configure `plugins/VoiceEngine/config.yml` on each server with matching credentials:

```yaml
voice-server-url: "wss://voice.yourdomain.com/ws/plugin"
secret-key: "generate-a-secure-random-secret"
proxy-mode: "true"
server-id: "survival-1"
```

:::tip
Setting `proxy-mode: "true"` on Paper delegates `/voice` session creation to the Velocity proxy, ensuring players maintain active voice calls uninterrupted when transitioning between servers.
:::

---

## Verifying Connection

1. Join your Minecraft server using a vanilla Java Edition client.
2. Type `/voice` in chat (or `/voice-velocity` on proxy console).
3. Click the generated link in chat:
   ```text
   https://voice.yourdomain.com/?token=A3B9X1
   ```
4. Allow microphone access when prompted by the browser. You will see the live radar HUD and your active voice status.
5. In the server console, run `/voice status` to confirm active WebSocket communication with the backend voice server.
