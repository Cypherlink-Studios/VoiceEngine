## MODIFIED Requirements

### Requirement: WebRTC SFU Media Routing
The voice backend SHALL manage WebRTC transports and audio streams using Mediasoup, receiving single upstream microphone tracks and selectively routing downstream audio based on proximity.

#### Scenario: Audio producer transport establishment
- **WHEN** an authenticated web client requests an upstream audio transport
- **THEN** the SFU SHALL initialize a WebRTC transport and register an audio producer for the client's Opus microphone stream.

#### Scenario: Dynamic downstream consumer subscription
- **WHEN** another player enters within audible proximity of a listener
- **THEN** the SFU SHALL establish an audio consumer if one does not exist or if the speaker's active producer ID has changed, or unpause an existing paused consumer matching the speaker's active producer ID without initiating WebRTC SDP renegotiation.

#### Scenario: Inaudible player unsubscription
- **WHEN** a speaking player moves beyond the maximum voice radius of a listener or leaves the dimension
- **THEN** the SFU SHALL pause downstream consumer RTP forwarding rather than destroying the consumer transport, conserving network bandwidth while avoiding SDP renegotiation.

#### Scenario: Explicit session termination and channel change culling
- **WHEN** a player disconnects from the voice server or changes active audio channels
- **THEN** the SFU SHALL close and remove the associated consumers and notify connected clients with a `consumer_closed` message.

### Requirement: Spatial Proximity Culling and State Dispatch
The server SHALL evaluate player Euclidean distances, server identifiers, and dimensions from plugin telemetry at each tick cycle, updating audio routing and dispatching relative spatial positions to listening clients.

#### Scenario: Inter-dimensional isolation
- **WHEN** two players are in different Minecraft worlds or on different backend servers within the network
- **THEN** the backend SHALL prevent any audio forwarding between them regardless of numeric coordinate proximity.

#### Scenario: Sneaking whisper attenuation
- **WHEN** a player speaks while sneaking
- **THEN** the server SHALL reduce their effective broadcast radius from the standard distance (30 blocks) to the whisper distance (8 blocks).

#### Scenario: Environmental submersion flagging
- **WHEN** a player's telemetry indicates they are underwater
- **THEN** the backend SHALL include the submerged environmental state flag in spatial updates sent to connected peers.

#### Scenario: Proximity spatial update with peer username and pause indicator
- **WHEN** spatial updates are dispatched to listening clients during proximity evaluation
- **THEN** the payload SHALL include the peer's Minecraft username (`peerUsername`), relative coordinates, distance, submersion status, and the pause status flag (`isPaused`).
