## MODIFIED Requirements

### Requirement: WebRTC SFU Media Routing
The voice backend SHALL manage WebRTC transports and audio streams using Mediasoup, receiving single upstream microphone tracks and selectively routing downstream audio based on proximity.

#### Scenario: Audio producer transport establishment
- **WHEN** an authenticated web client requests an upstream audio transport
- **THEN** the SFU SHALL initialize a WebRTC transport and register an audio producer for the client's Opus microphone stream.

#### Scenario: Dynamic downstream consumer subscription
- **WHEN** another player enters within audible proximity of a listener
- **THEN** the SFU SHALL establish an audio consumer if one does not exist, or unpause an existing paused consumer without initiating WebRTC SDP renegotiation.

#### Scenario: Inaudible player unsubscription
- **WHEN** a speaking player moves beyond the maximum voice radius of a listener or leaves the dimension
- **THEN** the SFU SHALL pause downstream consumer RTP forwarding rather than destroying the consumer transport, conserving network bandwidth while avoiding SDP renegotiation.

#### Scenario: Explicit session termination and channel change culling
- **WHEN** a player disconnects from the voice server or changes active audio channels
- **THEN** the SFU SHALL close and remove the associated consumers and notify connected clients with a `consumer_closed` message.

### Requirement: Fixed Channel Stereo Audio Routing
The backend SFU SHALL route audio for players inside the same fixed channel in stereo according to the channel's configured scope (global across the network or restricted to the current server).

#### Scenario: Routing audio within a fixed channel
- **WHEN** two or more connected players are joined to the same fixed channel configured with global scope (default)
- **THEN** the SFU SHALL create audio consumers forwarding speech between them at full gain regardless of distance, dimension, coordinates, or backend server.

#### Scenario: Routing audio within a server-scoped fixed channel
- **WHEN** players are joined to a fixed channel configured with server-isolated scope
- **THEN** the SFU SHALL only forward speech between players who are currently connected to the same backend server identifier.

#### Scenario: Mutual exclusion between proximity and channel routing
- **WHEN** a client is in `proximity` mode
- **THEN** the server routing cycle SHALL execute proximity spatial routing and SHALL NOT evaluate the client as a member of a fixed channel, preventing duplicate or thrashing consumer generation.
