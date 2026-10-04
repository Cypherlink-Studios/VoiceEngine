---
title: System Configuration
description: Complete reference of configuration directives for Paper servers and Velocity proxies.
sidebar:
  order: 3
---

This document provides a comprehensive reference of all settings available in Paper (`config.yml`) and Velocity (`velocity-config.yml`).

---

## Paper Configuration (`config.yml`)

Located at `plugins/VoiceEngine/config.yml`.

```yaml
# WebSocket URL of the VoiceEngine SFU backend
voice-server-url: "ws://localhost:3000/ws/plugin"

# Public Web Client URL sent to players in /voice
web-client-url: "http://localhost:5173"

# Shared HMAC secret key used for authenticating with the voice backend
secret-key: "change-me-to-a-secure-random-secret"

# Telemetry streaming frequency in Hz (10 to 15 recommended)
tick-rate-hz: 10

# Single-use 6-character session token time-to-live in minutes
token-ttl-minutes: 5

# Show connection prompt in chat when players join the server
notify-on-join: true

# Default language locale for players with unsupported client locales (en_US, es_ES)
default-locale: "en_US"

# Network server identifier
server-id: "default"

# Proxy mode: 'auto', 'true', or 'false'
# When 'true', suppresses local /voice commands and delegates to Velocity
proxy-mode: "auto"

# In-Game gameplay mechanics & audio acoustics
mechanics:
  # Reduce voice chat radius to 8 blocks when sneaking (Shift)
  whisper-on-sneak: true

  # Apply muffled biquad low-pass acoustics (600 Hz) when submerged in water
  underwater-acoustics: true

  # Display green musical note particles above player heads while speaking
  speaking-particles: true

  # Spectator voice behavior: 'listen-only', 'isolated', 'all'
  spectator-mode: "listen-only"

# Physical world speaker blocks (jukeboxes / world megaphones)
speakers:
  max-radius: 100
  default-radius: 30

# Dynamic 3D audio emitters
audio-emitters:
  max-emitters: 50
  particle-indicators: true
```

### Key Setting Explanations

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tick-rate-hz` | `integer` | `10` | Frequency in Hz at which player `(x, y, z)` positions and `(yaw, pitch)` orientations are streamed to the backend SFU. Values between 10 and 15 offer smooth audio panning without straining network buffers. |
| `proxy-mode` | `string` | `"auto"` | Automatically detects Velocity proxy presence. When set to `"true"`, suppresses local join notices and `/voice` handlers in favor of the proxy. |
| `mechanics.whisper-on-sneak` | `boolean` | `true` | Compresses standard audible voice range (30 blocks) down to 8 blocks while the player is sneaking. |
| `mechanics.underwater-acoustics` | `boolean` | `true` | Triggers a 600 Hz low-pass filter in the Web Audio API if either listener or speaker has their head submerged in water. |
| `mechanics.spectator-mode` | `string` | `"listen-only"` | Configures audio partitions for spectators (`listen-only`: hear living players but cannot speak to them; `isolated`: spectators talk in private isolation; `all`: unrestricted). |

---

## Velocity Configuration (`velocity-config.yml`)

Located at `plugins/voiceengine-velocity/velocity-config.yml`.

```yaml
# WebSocket URL of the VoiceEngine SFU backend
voice-server-url: "ws://localhost:3000/ws/plugin"

# Public Web Client URL
web-client-url: "http://localhost:5173"

# Shared HMAC secret key (must match backend and backend Paper servers)
secret-key: "change-me-to-a-secure-random-secret"

# Token expiration time in minutes
token-ttl-minutes: 5

# Show connection prompt in chat when players join the network
notify-on-join: true

# Adventure MiniMessage formatted join notice
join-message: "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Proximity voice chat is active on this network! Type <click:run_command:'/voice'><hover:show_text:'<gray>Click to get connection link</gray>'><yellow>/voice</yellow></hover></click> to connect.</gray>"
```

:::tip
Both configuration files support instant live reloading:
- Paper: `/voice reload` (permission: `voiceengine.admin.reload`).
- Velocity: `/voice-velocity reload` (permission: `voiceengine.admin`).
:::
