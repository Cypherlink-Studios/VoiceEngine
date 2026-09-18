# Paper Plugin Configuration Reference

This document provides a detailed breakdown of all settings in `plugins/VoiceEngine/config.yml`.

---

## Full Configuration File

Below is the complete default configuration template:

```yaml
# VoiceEngine Paper Plugin Configuration

# WebSocket URL of the VoiceEngine backend
voice-server-url: "ws://localhost:3000/ws/plugin"

# Public URL of the Web Client sent to players in /voice
web-client-url: "http://localhost:5173"

# Shared secret key used for authenticating with the voice backend
secret-key: "change-me-to-a-secure-random-secret"

# Telemetry streaming frequency in Hz (10 to 15 recommended)
tick-rate-hz: 10

# Token expiration time in minutes
token-ttl-minutes: 5

# Show connection prompt in chat when players join
notify-on-join: true

# Default language locale for players with unsupported client locales (e.g. en_US, es_ES)
default-locale: "en_US"

# Network server identifier (e.g. lobby, survival, minigames-1)
server-id: "default"

# Proxy mode: auto, true, or false.
# When enabled, suppresses local /voice commands and join notices, delegating to Velocity.
proxy-mode: "auto"

# In-Game Gameplay Mechanics & Visuals
mechanics:
  # Reduce voice chat radius to 8 blocks when players sneak (Shift)
  whisper-on-sneak: true

  # Apply muffled low-pass filter acoustics when submerged in water
  underwater-acoustics: true

  # Display musical note particles above player heads while speaking
  speaking-particles: true

  # Spectator voice behavior:
  # - listen-only: Spectators hear living players, but living players cannot hear spectators
  # - isolated: Spectators and living players cannot hear each other
  # - all: Spectators hear and can be heard by living players normally
  spectator-mode: "listen-only"

# Speaker Blocks System (Jukeboxes / World Megaphones)
speakers:
  # Master toggle for speaker blocks and /voice speaker commands
  enabled: true
  # Display subtle note particles at active speaker locations
  particles-enabled: true

# Audio Emitters & Media Playback Settings
audio:
  # Enable the audio emitter system
  enabled: true
  # Persist active emitters across restarts in audio.yml
  persistence-enabled: true
  # Render visual note particles at active spatial emitter locations
  particles-enabled: true
```

---

## Detailed Setting Explanations

### `voice-server-url`
- **Type**: `String (WebSocket URI)`
- **Default**: `"ws://localhost:3000/ws/plugin"`
- **Description**: The internal or external WebSocket endpoint where your VoiceEngine backend listens for plugin connections. 
- **Notes**:
  - If your Paper server and backend run on the same physical host, use `ws://127.0.0.1:3000/ws/plugin`.
  - If running across separate machines or in Docker containers, specify the private IP or internal DNS name (e.g. `ws://voice-backend:3000/ws/plugin`).
  - Secure WebSockets (`wss://`) are supported if your backend or reverse proxy uses SSL/TLS.

### `web-client-url`
- **Type**: `String (HTTP/HTTPS URL)`
- **Default**: `"http://localhost:5173"`
- **Description**: The public-facing URL where the frontend web client is hosted. When a player types `/voice` or `/voice admin`, this URL is combined with their session token (e.g. `https://voice.myserver.com/?token=A8K3Z1`).
- **Production Best Practice**: Always host your web client behind **HTTPS** with a valid SSL certificate (e.g. Let's Encrypt), as modern web browsers require a secure context (`navigator.mediaDevices.getUserMedia`) to access user microphones.

### `secret-key`
- **Type**: `String`
- **Default**: `"change-me-to-a-secure-random-secret"`
- **Description**: Shared HMAC secret key between the Paper plugin and the VoiceEngine backend.
- **Security**: The backend validates this token during the WebSocket connection handshake. Never share this secret with players or expose it publicly.

### `tick-rate-hz`
- **Type**: `Integer`
- **Default**: `10`
- **Range**: `5` to `20`
- **Description**: The frequency (in Hertz / cycles per second) at which the plugin collects player spatial positions and streams telemetry batches to the backend.
- **Recommendations**:
  - **10 Hz (Default)**: Optimal balance between smooth spatial tracking and low network overhead (one batch every 2 Minecraft ticks / 100 ms).
  - **15 Hz**: Ultra-smooth audio positioning for fast-paced mini-games or Elytra flight.
  - **5 Hz**: Low-bandwidth mode for high-concurrency servers (800+ concurrent players).

### `token-ttl-minutes`
- **Type**: `Integer`
- **Default**: `5`
- **Description**: Lifespan of newly generated 6-character connection tokens before they expire. Once a player connects their browser with the token, the session remains persistent until disconnect, regardless of token expiration.

### `notify-on-join`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: When set to `true`, players receive an interactive MiniMessage prompt in chat 2 seconds after joining the server, explaining that proximity voice chat is available and encouraging them to run `/voice`.
- **Proxy Behavior**: In Proxy Mode, this prompt is suppressed on Paper to prevent duplicate messages (Velocity sends the proxy-level announcement instead).

### `default-locale`
- **Type**: `String`
- **Default**: `"en_US"`
- **Options**: `"en_US"`, `"es_ES"`
- **Description**: Fallback language bundle used when a player's client language is not currently supported or cannot be detected.

### `server-id`
- **Type**: `String`
- **Default**: `"default"`
- **Description**: Unique identifier for this Paper server within a multi-server Bungee/Velocity network (e.g., `lobby`, `survival-1`, `bedwars-hub`).
- **Importance**: The VoiceEngine SFU backend uses `server-id` to segregate proximity audio so players on `lobby` do not hear players standing at the same coordinates in `survival`.

---

## Proxy Mode Deep-Dive

The `proxy-mode` setting controls how Paper interacts with a Velocity or BungeeCord proxy:

```
 proxy-mode: "auto"   --> Inspects Spigot/Paper bungeecord & proxy-forwarding settings
 proxy-mode: "true"   --> Forces Proxy Mode regardless of server configuration
 proxy-mode: "false"  --> Forces Standalone Mode (local /voice commands enabled)
```

### When Proxy Mode is Active:
1. **Local `/voice` Suppressed**: Players execute `/voice` on the Velocity proxy instead. Velocity creates the session token and sends it to the backend.
2. **Join Notifications Suppressed**: Paper stays silent on player join; Velocity handles the network join announcement.
3. **Telemetry Continues**: Paper continues sending player spatial coordinates and head rotations to the backend, tagged with `server-id`.
4. **World Features Active**: Administrators on Paper can still use `/voice speaker` and `/voice audio` to manage physical world audio.

> [!TIP]
> Leaving `proxy-mode: "auto"` is strongly recommended. If you ever run Paper as a standalone server, `/voice` will automatically activate; if you link it behind Velocity, it will automatically yield to Velocity.

---

## Audio Subsystem Settings

```yaml
audio:
  enabled: true
  persistence-enabled: true
  particles-enabled: true
```

- `audio.enabled`: Global kill-switch for 3D audio emitters and media playback.
- `audio.persistence-enabled`: When `true`, active emitters are saved to `plugins/VoiceEngine/audio.yml` and automatically restored across server restarts or reloads.
- `audio.particles-enabled`: When `true`, active 3D emitters display subtle note particles at their spatial coordinates so staff can locate them in-game. Can also be toggled live via `/voice audio particles <on|off|toggle>`.

---

## Gameplay Mechanics (`mechanics`)

Configure in-game audio physics, feedback effects, and spectator privacy policies:

```yaml
mechanics:
  whisper-on-sneak: true
  underwater-acoustics: true
  speaking-particles: true
  spectator-mode: "listen-only"
```

### `whisper-on-sneak`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: When `true`, crouching / sneaking (`Shift`) reduces the player's voice transmission radius down to whisper range (8 blocks). When set to `false`, voice transmission radius remains at normal speaking range regardless of crouching state.

### `underwater-acoustics`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: When `true`, being submerged in water applies low-pass acoustic filtering (muffled effect) to the player's voice transmission. When set to `false`, normal air acoustics are preserved even while diving underwater.

### `speaking-particles`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: When `true`, subtle musical note particles appear above players' heads while microphone voice activity is detected. Note particles are automatically suppressed for spectators or dead players regardless of this setting.

### `spectator-mode`
- **Type**: `String (Enum)`
- **Default**: `"listen-only"`
- **Options**:
  - `"listen-only"` (Recommended): Spectators and dead players can hear living players proximity audio, but living players cannot hear spectators. Prevents ghosting while letting spectators enjoy server chatter.
  - `"isolated"`: Spectators and living players are completely isolated from one another. Spectators only hear other spectators; living players only hear living players. Ideal for competitive mini-games.
  - `"all"`: Unrestricted voice communication between spectators and living players.

---

## Speaker Blocks (`speakers`)

Configure the physical speaker block (megaphone / jukebox) subsystem:

```yaml
speakers:
  enabled: true
  particles-enabled: true
```

### `speakers.enabled`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: Master kill-switch for speaker blocks. When `false`, speaker persistence, redstone listeners, and `/voice speaker` commands are disabled.

### `speakers.particles-enabled`
- **Type**: `Boolean`
- **Default**: `true`
- **Description**: When `true`, active speaker blocks emit subtle note particles to visually indicate that sound is being relayed. Can also be toggled dynamically in-game with `/voice speaker particles [true|false]`.

