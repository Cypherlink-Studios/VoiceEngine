## Why

In multiplayer networks using VoiceEngine, server administrators and event organizers require enhanced in-game controls, robust moderation tools, and seamless server operations without restarting Minecraft instances. Currently, `/voice reload` fails to rebind critical configuration parameters such as `server-id` and backend authentication tokens. Furthermore, no in-game moderation framework exists to mute, deafen, kick, or ban disruptive users across the network, leaving servers vulnerable to harassment and ban evasion via token-sharing or alternate accounts. Additionally, event staff lack a mechanism to broadcast announcements to localized in-game audiences (megaphones/speaker blocks) with consistent acoustic clarity.

## What Changes

- **Speaker Block System (Staff / Events)**:
  - Adds in-game administrative commands (`/voice speaker create|link|unlink|remove|list|redstone`) to designate any targeted block as a virtual sound emitter with a configurable radius.
  - Renders broadcast audio as uniform 2D stereo (PA / megaphone acoustics) within the block's coverage area, bypassing 3D HRTF panning for optimal clarity.
  - Implements proximity conflict resolution: megaphone broadcast takes precedence over 3D direct proximity when a listener is within range of both.
  - Adds optional Redstone power activation and in-game musical note particle feedback (`Particle.NOTE`) at the speaker block when the linked player speaks.
  - Persists configured speakers in `plugins/VoiceEngine/speakers.yml`.
- **Complete Hot-Reload (`/voice reload`)**:
  - Re-reads and regenerates all configuration values in Paper without requiring a server reboot.
  - Gracefully terminates and re-authenticates the backend WebSocket connection (`VoiceBackendClient`) with updated `server-id`, `secret-key`, and URI headers.
  - Dynamically updates session token TTL in `TokenManager` and schedules tasks at the revised telemetry tick rate.
- **Proxy-Centric Moderation Framework**:
  - Implements a central SQLite database (`moderation.db`) hosted on Velocity (with automatic standalone fallback on Paper for single-server setups).
  - Introduces comprehensive moderation commands: `/voice mute|deafen|kick|ban <player> [duration] [reason]`, plus `/voice unmute|undeafen|unban` and `/voice modstatus`.
  - Supports standard duration units (`30s`, `15m`, `2h`, `1d`, `7d`, `perm`).
  - Syncs real-time punishment events via WebSocket to `voice-server`, triggering Mediasoup producer pauses (mute), consumer pauses (deafen), and forced transport/socket drops (kick/ban).
- **Multi-Layered Anti-Ban Evasion Protection**:
  - **Token IP Binding**: Binds issued session tokens to the player's Minecraft public IP and verifies it during WebRTC WebSocket connection (`4003: IP_MISMATCH`).
  - **Presence Binding**: Listens to Minecraft disconnect events (`DisconnectEvent` on Velocity / `PlayerQuitEvent` on Paper) and instantly terminates the player's web client session.
  - **Device ID Fingerprinting**: Persists a cryptographic device identifier in the web client's `localStorage`; flags banned devices in `voice-server` to reject connections from alternate accounts on the same machine.
  - **Network IP Banning**: Automatically records player IP on ban to reject token requests and web client handshakes from banned network origins.

## Capabilities

### New Capabilities
- `speaker-blocks`: Administrative creation and lifecycle management of 2D megaphone virtual sound emitters in Paper, linked to speaking players and synchronized to the voice backend.
- `voice-moderation`: Centralized punishment persistence (SQLite on Velocity/Paper), staff command interface, real-time backend synchronization, and web client moderation banners.

### Modified Capabilities
- `paper-voice-bridge`: Hot-reload of all configuration attributes without server restart, quit listener for presence binding, and telemetry streaming of speaker blocks.
- `velocity-voice-proxy`: Presence binding on player disconnect, token IP-binding, and ban enforcement at token issuance.
- `voice-backend-sfu`: Real-time enforcement of moderation actions (pausing producers/consumers, closing sessions), token IP validation, device-id tracking, and 2D megaphone audio routing for speaker blocks.
- `web-client-spatial-audio`: 2D megaphone audio rendering (bypassing HRTF panning), persistent device ID generation, and moderation status notifications.

## Impact

- **Paper Plugin (`paper-plugin`)**: New `SpeakerManager`, `SpeakerCommands`, updated `VoiceCommands` / `VoiceEnginePlugin.reloadPlugin()`, and `PlayerQuitEvent` listener.
- **Velocity Proxy (`velocity-plugin`)**: New `ModerationManager` with SQLite connection, moderation commands via Cloud Velocity, token issuance validation, and enhanced `DisconnectListener`.
- **Voice Server (`voice-server`)**: Extended `SpatialEngine` to handle speaker blocks, updated `PluginGateway` for moderation actions, IP validation in `ClientGateway`, and Mediasoup producer/consumer pause controls.
- **Web Client (`web-client`)**: PannerNode bypass for broadcast audio, device identifier generation, and UI ban/mute banners.
- **Dependencies**: Adds SQLite JDBC driver to Velocity/Paper plugins.
