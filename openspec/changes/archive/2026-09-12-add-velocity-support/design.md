# Technical Design: Velocity Proxy Support and Multi-Backend Network Voice Chat

## Context

See proposal.md for motivation. Currently, oice-server/src/gateway/PluginGateway.ts manages a single ctivePluginSocket, and SpatialEngine.ts checks only speaker.world === listener.world. In a Minecraft network managed by Velocity, multiple Paper backend instances operate concurrently with players transitioning between them dynamically.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated elocity-plugin Gradle module interfacing with Velocity 3.4+ and Incendo Cloud Velocity 2.0.
- Centralize /voice commands and initial network welcome notifications on Velocity.
- Enable PluginGateway to manage multiple Paper backend sockets identified by serverId alongside the Velocity proxy socket.
- Isolate 3D spatial audio by both server identifier and world (speaker.serverId === listener.serverId && speaker.world === listener.world).
- Support seamless WebRTC session persistence across backend server switches without browser reconnects.
- Support configurable fixed channel scope (scope: 'global' | 'server', default 'global') across backend boundaries.
- Maintain full standalone Paper compatibility when running without Velocity (proxy-mode: false).

**Non-Goals:**
- Parsing player movement packets inside Velocity (Paper remains the authority for world coordinates, yaw, pitch, sneaking, and submersion).
- Modifying the core WebRTC SFU engine (Mediasoup transports remain bound to playerUuid).

## Decisions

### 1. Dual-Tier Hybrid Architecture (Velocity Orchestrator + Paper Telemetry Agents)
- **Choice**: Velocity handles network-wide commands (/voice, /voice admin, /voice reload) and session token creation. Paper servers act as telemetry agents streaming coordinates and rendering speech feedback particles.
- **Rationale**: Keeps network proxy overhead minimal (avoiding routing high-frequency 20 Hz coordinate batches through Minecraft Plugin Messaging) while providing a unified player onboarding experience.
- **Alternatives Considered**: Routing all spatial telemetry via Velocity Plugin Messaging. Rejected because streaming 20 Hz batches for dozens/hundreds of players would congest proxy networking threads.

### 2. Multi-Socket PluginGateway Management
- **Choice**: Structure PluginGateway to hold:
  - elocitySocket?: WebSocket (role: elocity)
  - paperSockets: Map<string, WebSocket> (role: paper, keyed by serverId)
- **Handshake Protocol**:
  `json
  {
    type: plugin_handshake,
    secret: ...,
    role: paper | velocity,
    serverId: lobby
  }
  `
- **Speech Status Routing**: When a player speaks, ClientGateway looks up their current serverId in SpatialEngine and forwards speech_status directly to that server's socket.
- **Alternatives Considered**: Broadcasting speech status to all Paper sockets. Viable as a fallback, but targeted routing reduces unnecessary network overhead.

### 3. Dimensional and Server Isolation in SpatialEngine
- **Choice**: Compare both serverId and world during proximity calculations:
  `	ypescript
  if (speaker.serverId !== listener.serverId || speaker.world !== listener.world) {
    continue;
  }
  `
- **Rationale**: Many Paper servers share default world names (world, world_nether, world_the_end). Without serverId, players in lobby and survival would hear each other if located near the same XYZ coordinates.

### 4. Seamless WebRTC Server Switching Lifecycle
- **Choice**: The web client maintains an open WebRTC connection keyed to playerUuid. When a player switches servers in Minecraft:
  1. Paper on server B sends spatial telemetry for the player with serverId: B.
  2. SpatialEngine updates the player's serverId and spatial position.
  3. The next proximity tick (50ms) in ClientGateway detects that server A peers are no longer audible, smoothly closing old consumers and creating new consumers for nearby players on server B.
  4. No WebRTC renegotiation, page reload, or re-authentication is required.

### 5. Configurable Fixed Channel Scope
- **Choice**: Extend FixedChannelConfig with scope?: 'global' | 'server':
  - Default: 'global' (players in the channel hear each other across the entire network).
  - 'server': Only players currently on the same backend serverId hear each other.
- **Admin UI**: Add a radio/select control to ChannelsTab.tsx in web-client.

## Risks / Trade-offs

- **[Risk] Telemetry arriving before server switch notification** → *Mitigation*: SpatialEngine updates serverId directly from incoming 	elemetry_batch frames, ensuring immediate consistency without relying on race-prone external switch events.
- **[Risk] Standalone Paper deployments breaking** → *Mitigation*: If serverId is omitted, PluginGateway defaults it to default. If proxy-mode is alse, Paper retains full standalone /voice command registration and join notifications.
- **[Risk] Proxy WebSocket connection loss** → *Mitigation*: The Velocity plugin implements the same resilient exponential backoff reconnect loop used in paper-plugin's VoiceBackendClient.

## Migration Plan

1. Deploy updated oice-server with multi-socket gateway and channel scope support.
2. Deploy updated paper-plugin with server-id set in config.yml and proxy-mode: true.
3. Deploy new elocity-plugin to the Velocity proxy and configure the voice backend URI and secret key.
