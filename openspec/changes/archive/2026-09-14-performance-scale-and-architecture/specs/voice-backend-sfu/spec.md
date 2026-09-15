## MODIFIED Requirements

### Requirement: WebRTC SFU Media Routing
The voice backend SHALL manage WebRTC transports and audio streams using a multi-worker Mediasoup pool, receiving single upstream microphone tracks and selectively routing downstream audio based on proximity across worker routers via inter-worker pipe transports.

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

## ADDED Requirements

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
