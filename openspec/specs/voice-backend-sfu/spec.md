# voice-backend-sfu Specification

## Purpose
Provides real-time WebRTC media routing, token validation, dynamic proximity culling, and plugin telemetry synchronization for spatial voice chat.

## Requirements

### Requirement: WebRTC SFU Media Routing
The voice backend SHALL manage WebRTC transports and audio streams using a multi-worker Mediasoup pool, receiving single upstream microphone tracks configured with Opus In-Band Forward Error Correction (FEC), Discontinuous Transmission (DTX), and configurable packet bitrate/framing, and selectively routing downstream audio based on proximity across worker routers via inter-worker pipe transports.

#### Scenario: Audio producer transport establishment
- **WHEN** an authenticated web client requests an upstream audio transport
- **THEN** the SFU SHALL allocate the transport to the least-loaded worker in the worker pool, initialize a WebRTC transport within the worker's assigned RTC port range (`40000-49999`), and register an audio producer for the client's Opus microphone stream.

#### Scenario: Dynamic downstream consumer subscription
- **WHEN** another player enters within audible proximity of a listener whose transport resides on a different Mediasoup worker router
- **THEN** the SFU SHALL establish an inter-worker `PipeTransport` between the producer's router and the consumer's router if not already piped, and instantiate or unpause the downstream audio consumer on the listener's local worker without initiating WebRTC SDP renegotiation.

#### Scenario: Inaudible player unsubscription
- **WHEN** a speaking player moves beyond the maximum voice radius of a listener or leaves the dimension
- **THEN** the SFU SHALL pause downstream consumer RTP forwarding rather than destroying the consumer transport, conserving network bandwidth while avoiding SDP renegotiation.

#### Scenario: Explicit session termination and channel change culling
- **WHEN** a player disconnects from the voice server or changes active audio channels
- **THEN** the SFU SHALL close and remove the associated consumers, clean up any unused inter-worker pipe transports, and notify connected clients with a `consumer_closed` message.

#### Scenario: Opus Forward Error Correction (FEC) negotiation
- **WHEN** an audio producer or consumer negotiates RTP capabilities with the SFU router
- **THEN** the SFU router SHALL declare `useinbandfec: 1` in the Opus codec parameters, and the client producer SHALL enable in-band FEC (`opusFec: true`) to embed redundant packet recovery data directly in the audio stream.

#### Scenario: Opus Discontinuous Transmission (DTX) silence compression
- **WHEN** a speaking client enters silence or pauses speech while the audio track remains active
- **THEN** the Opus encoder SHALL operate with DTX enabled (`usedtx: 1`, `opusDtx: true`), reducing RTP packet transmission to low-overhead comfort noise frames, and the SFU SHALL route these packets without tearing down or stalling the WebRTC pipeline.

#### Scenario: Configurable audio bitrate and packet framing
- **WHEN** the voice server initializes worker routers and transports
- **THEN** the SFU SHALL configure the Opus codec with the server's configured maximum average bitrate (default 64 kbps, 48 kHz clock rate, stereo enabled) and 20ms packet duration framing (`ptime: 20`, `minptime: 10`, `maxptime: 60`).

### Requirement: Spatial Proximity Culling and State Dispatch
The server SHALL evaluate player coordinates, server identifiers, and dimensions from plugin telemetry at each tick cycle using a 3D spatial grid hash, dispatching batched relative spatial updates in a compact binary format and suppressing updates for stationary players.

#### Scenario: Inter-dimensional isolation
- **WHEN** two players are in different Minecraft worlds or on different backend servers within the network
- **THEN** the backend SHALL prevent any audio forwarding between them regardless of numeric coordinate proximity by isolating spatial grid partitions by `serverId:world`.

#### Scenario: Sneaking whisper attenuation
- **WHEN** a player speaks while sneaking
- **THEN** the server SHALL reduce their effective broadcast radius from the standard distance (30 blocks) to the whisper distance (8 blocks).

#### Scenario: Environmental submersion flagging
- **WHEN** a player's telemetry indicates they are underwater
- **THEN** the backend SHALL include the submerged environmental state flag in the batched spatial update sent to connected peers.

#### Scenario: Proximity spatial update with peer username and pause indicator
- **WHEN** spatial updates are dispatched to listening clients during proximity evaluation
- **THEN** the payload SHALL include the peer's Minecraft username (`peerUsername`), relative coordinates, distance, submersion status, and the pause status flag (`isPaused`), delivered via compact binary framing or fallback JSON batches.

#### Scenario: 3D Grid Spatial Partitioning with Squared Distance Pre-Filtering
- **WHEN** the spatial proximity tick executes
- **THEN** the engine SHALL query only the listener's cell and immediately adjacent neighboring cells within the 3D grid hash, filtering candidates using squared Euclidean distance ($dx^2 + dy^2 + dz^2 \le r^2$) before performing trigonometric transformation into local coordinates.

#### Scenario: Configurable Deadband Delta Suppression
- **WHEN** a player's relative position and orientation change relative to a listener by less than the configured deadband thresholds (e.g. displacement $< 0.08$ blocks and yaw change $< 2^\circ$)
- **THEN** the server SHALL suppress the spatial update frame for that peer in the current tick, eliminating redundant network traffic.

#### Scenario: Compact Binary Spatial Batch Framing
- **WHEN** audible peer spatial updates are dispatched to a listening client
- **THEN** the server SHALL encode all audible peers into a single batched binary frame (`ArrayBuffer` containing message type header, peer UUIDs, packed 16-bit relative coordinates, distance, and packed bitmask flags for submersion, pause, and broadcast) transmitted over WebSocket.

### Requirement: Plugin WebSocket Control and Token Verification
The backend SHALL host an authenticated WebSocket control endpoint supporting concurrent connections from multiple Paper plugins identified by serverId and an optional Velocity proxy plugin to exchange session tokens, positional batches, moderation events, and speaking state indicators.

#### Scenario: Plugin handshake authentication
- **WHEN** a Paper plugin or Velocity proxy plugin connects to the control endpoint presenting the configured secret key
- **THEN** the backend SHALL accept the connection, record its role (paper or velocity) and server identifier (serverId), and manage multiple concurrent backend sockets without clobbering existing connections.

#### Scenario: One-time token redemption
- **WHEN** a web client attempts to join with a temporary token generated by either a Paper plugin or the Velocity proxy
- **THEN** the backend SHALL authenticate the session, verify that the browser WebSocket remote IP matches the token's bound client IP (or allow local development loopback), link it with the player's Minecraft UUID, and consume the token so it cannot be reused.

#### Scenario: Token redemption IP mismatch rejection
- **WHEN** a web client attempts to redeem a token from an IP address differing from the IP address recorded when the token was generated in Minecraft
- **THEN** the backend SHALL reject the connection with an `IP_MISMATCH` error code (`4003`) and close the socket.

#### Scenario: Targeted speaking state notification dispatch
- **WHEN** a client initiates or terminates speech
- **THEN** the backend SHALL dispatch speech_status indicators to the specific Paper backend socket where the player is currently situated based on spatial telemetry.

### Requirement: Fixed Channel Stereo Audio Routing
The backend SFU SHALL route audio for players inside the same fixed channel in stereo according to the channel's configured scope (global across the network or restricted to the current server), strictly isolated from the proximity 3D routing cycle.

#### Scenario: Routing audio within a fixed channel
- **WHEN** two or more connected players are joined to the same fixed channel configured with global scope (default)
- **THEN** the SFU SHALL create audio consumers forwarding speech between them at full gain regardless of distance, dimension, coordinates, or backend server.

#### Scenario: Routing audio within a server-scoped fixed channel
- **WHEN** players are joined to a fixed channel configured with server-isolated scope
- **THEN** the SFU SHALL only forward speech between players who are currently connected to the same backend server identifier.

#### Scenario: Mutual exclusion between proximity and channel routing
- **WHEN** a client is in `proximity` mode
- **THEN** the server routing cycle SHALL execute proximity spatial routing and SHALL NOT evaluate the client as a member of a fixed channel, preventing duplicate or thrashing consumer generation.

### Requirement: Server Settings Persistence and Public Configuration API
The backend SHALL maintain a persistent `data/settings.json` file and expose a public endpoint `GET /api/config/public` returning brand settings and active fixed channels.

#### Scenario: Public configuration retrieval
- **WHEN** a client sends a GET request to `/api/config/public`
- **THEN** the backend SHALL return current branding information, slot limits, and available public fixed channels.

### Requirement: Administrative Authentication and Protected API
The backend SHALL validate administrative session tokens and expose protected endpoints for updating settings and reading metrics.

#### Scenario: Admin token redemption
- **WHEN** a client submits a valid admin token to `/api/admin/auth`
- **THEN** the backend SHALL issue an administrative session token and authorize access to `/api/admin/settings`.

### Requirement: WebSocket Client Latency Probe Protocol
The voice server client gateway SHALL handle client ping messages and immediately respond with pong frames carrying the client's original timestamp.

#### Scenario: Client ping dispatch and immediate server pong response
- **WHEN** a connected web client sends a `{ type: 'ping', timestamp: number }` WebSocket frame
- **THEN** the client gateway SHALL immediately respond with `{ type: 'pong', timestamp: number }` echoing the received timestamp.

### Requirement: Real-Time Moderation SFU Enforcement
The voice backend SHALL enforce moderation actions received from the Minecraft network directly on Mediasoup audio routers, transports, and client sessions.

#### Scenario: SFU pauses microphone producer upon mute
- **WHEN** a moderation event indicates a connected player has been muted
- **THEN** the SFU SHALL pause the player's audio producer, notify their web client with a `moderation_notice` frame, and cease relaying their audio to peers.

#### Scenario: SFU pauses consumer playback upon deafen
- **WHEN** a moderation event indicates a connected player has been deafened
- **THEN** the SFU SHALL pause all downstream audio consumers streaming to that player.

#### Scenario: SFU closes sessions upon kick or ban
- **WHEN** a moderation event indicates a player has been kicked or banned
- **THEN** the voice server SHALL close their WebRTC transports, close their WebSocket connection with code `4003`, and record their device ID and IP if banned.

### Requirement: 2D Megaphone Speaker Block Audio Routing
The `SpatialEngine` SHALL compute audible peers for listeners located within the radius of active speaker blocks, delivering unspatialized 2D broadcast coordinates.

#### Scenario: Listener in speaker block radius receives broadcast audio
- **WHEN** a listener is within the configured radius of an active speaker block linked to an online speaking player
- **THEN** the engine SHALL register the linked speaker as audible with `isBroadcast: true` and relative offsets `relX: 0, relY: 0, relZ: 0`.

#### Scenario: Megaphone broadcast overrides direct proximity
- **WHEN** a listener is within range of both the speaker block and the direct 3D proximity of the linked speaking player
- **THEN** the engine SHALL prioritize the 2D broadcast signal, preventing dual-stream audio duplication.

### Requirement: Prometheus Observability Endpoint
The voice backend SHALL expose an industry-standard `GET /metrics` HTTP endpoint compliant with Prometheus exposition format, tracking real-time server health and scaling metrics.

#### Scenario: Scraping server operational metrics
- **WHEN** a Prometheus scraper or monitoring agent performs a `GET /metrics` request
- **THEN** the server SHALL return metrics including Event Loop Delay (percentiles and max lag), active WebRTC transports, producers and consumers per Mediasoup worker, inter-worker pipe count, spatial calculation tick duration in milliseconds, and WebSocket message dispatch rate.

### Requirement: Automated Operational Discord Health Alerts
The voice backend SHALL evaluate operational health thresholds and dispatch formatted warning and critical webhook notifications to a configured Discord channel.

#### Scenario: Event loop lag threshold alert dispatch
- **WHEN** Node.js event loop delay exceeds 30ms continuously for more than 3 seconds
- **THEN** the server SHALL dispatch a rate-limited Discord embed alert detailing current player count, active worker CPU usage, and spatial tick duration.

#### Scenario: Mediasoup worker CPU exhaustion alert
- **WHEN** any Mediasoup worker process CPU utilization exceeds 85%
- **THEN** the server SHALL dispatch an operational warning embed to the configured Discord webhook indicating the saturated worker ID and transport load.
