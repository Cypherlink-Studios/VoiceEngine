## ADDED Requirements

### Requirement: Synchronized Media Pipeline and Linear Distance Attenuation
The web client SHALL maintain a dedicated media audio pipeline that synchronizes playback time with the voice server and renders 3D spatial emitters using linear distance attenuation.

#### Scenario: Clock synchronization via lightweight WebSocket NTP
- **WHEN** the web client connects or receives server time sync frames
- **THEN** the client SHALL calculate the round-trip latency and clock offset (`clockOffset = serverTime - (clientTime + rtt / 2)`) to align client time with the voice server.

#### Scenario: Absolute offset seeking upon entering emitter radius
- **WHEN** a listener moves within the radius of an active spatial emitter
- **THEN** the client SHALL initialize playback at the exact elapsed offset (`(clientNow + clockOffset - startedAt) % duration`), aligning playback with other listeners.

#### Scenario: Linear distance attenuation rendering
- **WHEN** a spatial audio emitter is within audible radius
- **THEN** the client SHALL connect the stream to a `PannerNode` configured with `distanceModel = 'linear'`, attenuating volume proportionally to distance until reaching zero at max radius.

#### Scenario: Node suspension when out of audible radius
- **WHEN** the listener moves beyond the radius of an active spatial emitter
- **THEN** the client SHALL pause the `<audio>` element and disconnect the `PannerNode` to conserve browser CPU and audio decoding resources.

### Requirement: Isolated Client-Side Media Volume Control
The web client SHALL provide separate local volume controls for media emitters that do not impact player voice volume or global server playback state.

#### Scenario: User adjusts media volume slider
- **WHEN** a user adjusts the "Media & Music Volume" slider in the settings modal
- **THEN** the client SHALL adjust the gain multiplier on the dedicated `mediaBusGain` node without affecting `proximityBusGain` or incoming peer volumes.

#### Scenario: User toggles media mute
- **WHEN** a user activates the "Mute Media" toggle
- **THEN** the client SHALL mute the `mediaBusGain` node, silencing all background music and emitters while keeping proximity and channel voice chat fully audible.
