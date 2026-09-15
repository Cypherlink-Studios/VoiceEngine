## MODIFIED Requirements

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
