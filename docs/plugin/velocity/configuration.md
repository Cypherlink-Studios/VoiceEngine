# Velocity Proxy Configuration Reference

This document covers all configuration directives for `plugins/voiceengine-velocity/velocity-config.yml`.

---

## Full Configuration File

```yaml
# VoiceEngine Velocity Proxy Configuration

# WebSocket URL of the VoiceEngine backend
voice-server-url: "ws://localhost:3000/ws/plugin"

# Public URL of the Web Client sent to players in /voice
web-client-url: "http://localhost:5173"

# Shared secret key used for authenticating with the voice backend
secret-key: "change-me-to-a-secure-random-secret"

# Token expiration time in minutes
token-ttl-minutes: 5

# Show connection prompt in chat when players join the network
notify-on-join: true

# MiniMessage formatted join notification message
join-message: "<gradient:#6366f1:#a855f7><bold>[VoiceEngine]</bold></gradient> <gray>Proximity voice chat is active on this network! Type <click:run_command:'/voice'><hover:show_text:'<gray>Click to get connection link</gray>'><yellow>/voice</yellow></hover></click> to connect.</gray>"
```

---

## Detailed Setting Explanations

### `voice-server-url`
- **Type**: `String (WebSocket URI)`
- **Default**: `"ws://localhost:3000/ws/plugin"`
- **Description**: The WebSocket address where Velocity connects to the VoiceEngine SFU backend.
- **Notes**: Velocity uses this connection to validate tokens, report player IP addresses, and send live moderation actions (`kick`, `mute`, `deafen`, `ban`).

### `web-client-url`
- **Type**: `String (HTTP/HTTPS URL)`
- **Default**: `"http://localhost:5173"`
- **Description**: The base URL where your web frontend is deployed. When players run `/voice`, Velocity embeds this URL with the player's 6-character session token:
  ```text
  https://voice.yournetwork.com/?token=K9Z2X1
  ```
- **Security**: Must be HTTPS in production so web browsers permit microphone recording.

### `secret-key`
- **Type**: `String`
- **Default**: `"change-me-to-a-secure-random-secret"`
- **Description**: The shared HMAC secret string used during WebSocket handshake authentication. Must match the backend's `PLUGIN_SECRET` and the `secret-key` configured across all backend Paper servers.

### `token-ttl-minutes`
- **Type**: `Integer`
- **Default**: `5`
- **Description**: How long a generated 6-character connection token remains valid before expiring. 

### `notify-on-join`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: If `true`, players connecting to the Velocity proxy receive the `join-message` in chat upon entering their first backend server.

### `join-message`
- **Type**: `String (Kyori Adventure MiniMessage format)`
- **Default**: Gradient badge with clickable `/voice` command.
- **Description**: The formatted notification sent to joining players.

---

## MiniMessage Formatting Examples

The `join-message` supports full [Kyori MiniMessage](https://docs.advntr.dev/minimessage/format.html) syntax, including gradients, RGB colors, hover tooltips, and click actions.

### Example 1: Sleek Modern Cyan & Blue
```yaml
join-message: "<gradient:#00f2fe:#4facfe><bold>[VOICE]</bold></gradient> <white>Proximity voice chat is enabled!</white> <click:run_command:'/voice'><hover:show_text:'<aqua>Click to connect your mic</aqua>'><yellow>[Click to Connect]</yellow></hover></click>"
```

### Example 2: Minimalist Dark Gold
```yaml
join-message: "<gold><bold>»</bold> <yellow>VoiceEngine:</yellow> <gray>Jump into proximity voice with <click:run_command:'/voice'><gold><u>/voice</u></gold></click></gray>"
```

---

## Applying Changes Live

To reload `velocity-config.yml` without restarting your Velocity proxy:

```bash
/voice-velocity reload
```

If the `voice-server-url` or `secret-key` are modified, the plugin will automatically disconnect from the old backend and re-establish a fresh authenticated WebSocket session.
