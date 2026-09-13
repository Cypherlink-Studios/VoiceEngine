## MODIFIED Requirements

### Requirement: Binaural 3D Spatial Audio Rendering
The web client SHALL process incoming peer audio streams through the Web Audio API using HRTF `PannerNode` instances positioned according to in-game relative coordinates and orientations, or bypass spatialization when receiving broadcast audio.

#### Scenario: Dynamic 3D positional positioning
- **WHEN** a relative position packet is received for an audible peer without broadcast flags
- **THEN** the client SHALL interpolate and apply the X, Y, and Z offsets to that peer's `PannerNode` relative to the local listener's yaw and pitch.

#### Scenario: Submerged low-pass acoustic filtering
- **WHEN** spatial telemetry flags that either the listener or speaker is submerged in water
- **THEN** the client SHALL route the incoming stream through a BiquadFilterNode configured as a low-pass filter to produce muffled acoustic damping.

#### Scenario: Proximity radar visualization
- **WHEN** audible players are within proximity range
- **THEN** the client UI SHALL display their relative distance, direction, and speaking activity on a radar display.

#### Scenario: Speaker block 2D broadcast bypass
- **WHEN** incoming peer audio is flagged with `isBroadcast: true`
- **THEN** the client SHALL route the audio stream directly to master output gain, bypassing the 3D HRTF `PannerNode` to deliver uniform stereo audio across the speaker block's coverage area.

## ADDED Requirements

### Requirement: Persistent Device Fingerprint Generation
The web client SHALL generate and store a persistent cryptographic device identifier in browser storage to detect alternate account connections from the same machine.

#### Scenario: Client transmits device ID during handshake
- **WHEN** the web client connects and authenticates with the voice backend
- **THEN** the client SHALL load or generate a persistent UUID stored in `localStorage` and transmit it inside the `client_auth` frame.

### Requirement: Moderation Status UI Banner
The web client SHALL display clear visual status indicators when a player is subjected to moderation sanctions.

#### Scenario: Muted or deafened banner notification
- **WHEN** the client receives a `moderation_notice` frame indicating an active mute or deafen
- **THEN** the UI SHALL render an alert banner detailing the sanction type, reason, and remaining duration, and disable the corresponding microphone input controls.
