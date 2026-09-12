# Proposal: Velocity Proxy Support and Multi-Backend Network Voice Chat

## Why

In Minecraft networks utilizing Velocity proxies (e.g. Lobby, Survival, Minigames), players constantly switch between backend servers. Currently, VoiceEngine only supports a single Paper instance connected to the Voice Server; connecting multiple Paper servers results in socket collisions, world name collision (e.g., players in lobby:world and survival:world hearing each other), and fragmented command access. Adding dedicated Velocity support enables automatic, seamless voice chat persistence across the entire network—players authenticate once when joining the network, and their WebRTC audio session transitions smoothly across backend servers without reconnections.

## What Changes

- **Velocity Proxy Plugin (elocity-plugin)**: Introduce a dedicated Velocity plugin that registers the global /voice command (link, admin, reload), generates session tokens, connects to the Voice Server via WebSocket, and handles network-level player join notifications.
- **Paper Plugin Worker & Proxy Mode**: Update paper-plugin with server-id configuration and a proxy-mode toggle (or auto-detection) that silences local /voice registration and join messages when running behind Velocity, while sending serverId in spatial telemetry batches.
- **Voice Server Multi-Backend Support**: Extend PluginGateway to manage multiple Paper backend sockets identified by serverId and a dedicated Velocity proxy socket.
- **Spatial Isolation by Server & World**: Update SpatialEngine so 3D proximity calculations isolate players across both serverId and world (speaker.serverId === listener.serverId && speaker.world === listener.world).
- **Fixed Channel Scope (Global vs Server)**: Add configurable scope ('global' | 'server', default 'global') to FixedChannelConfig allowing Discord-style channels to span across all network backends or isolate to the player's current backend.
- **Admin Portal Channel Scope Customizer**: Update /admin ChannelsTab UI so administrators can configure channel scope when creating or modifying fixed channels.

## Capabilities

### New Capabilities
- elocity-voice-proxy: Dedicated Velocity proxy plugin providing centralized /voice commands, cross-network session token registration, and network join/switch notifications.

### Modified Capabilities
- paper-voice-bridge: Adds serverId to spatial telemetry batches and introduces proxy-mode configuration to suppress redundant local /voice commands and join notices.
- oice-backend-sfu: Adds multi-socket plugin connections in PluginGateway, [serverId, world] isolation in SpatialEngine, and channel scope filtering (global vs server-isolated) in fixed channel audio routing.
- dmin-portal-and-customization: Adds scope configuration to fixed channels form in /admin portal (defaulting to global).

## Impact

- **New Subproject**: elocity-plugin/ built with Gradle, Velocity API 3.4+, and Incendo Cloud Velocity.
- **paper-plugin/**: Updates to VoiceConfig, PlayerSpatialState, SpatialTelemetryBatch, VoiceEnginePlugin, and CommandService.
- **oice-server/**: Updates to PluginGateway.ts, SpatialEngine.ts, ClientGateway.ts, and 	ypes.ts.
- **web-client/**: Updates to ChannelsTab.tsx and channel type definitions.
- **Backwards Compatibility**: Standalone Paper servers remain fully functional when proxy-mode: false (or when running without Velocity).
