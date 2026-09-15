## MODIFIED Requirements

### Requirement: Binaural 3D Spatial Audio Rendering
The web client SHALL process incoming peer audio streams through the Web Audio API using HRTF `PannerNode` instances positioned according to in-game relative coordinates and orientations parsed from batched binary or JSON telemetry frames, or bypass spatialization when receiving broadcast audio.

#### Scenario: Dynamic 3D positional positioning
- **WHEN** relative position updates are received for an audible peer via binary `ArrayBuffer` batch frames or fallback JSON frames without broadcast flags
- **THEN** the client SHALL interpolate and apply the X, Y, and Z offsets to that peer's `PannerNode` relative to the local listener's yaw and pitch using smooth linear ramp transitions.

#### Scenario: Deadband position retention
- **WHEN** an audible peer is omitted from an incoming tick's spatial batch due to server-side deadband suppression
- **THEN** the client SHALL retain the peer's existing PannerNode position and audio routing without resetting coordinates or pausing audio playback.

#### Scenario: Submerged low-pass acoustic filtering
- **WHEN** spatial telemetry flags that either the listener or speaker is submerged in water
- **THEN** the client SHALL route the incoming stream through a BiquadFilterNode configured as a low-pass filter to produce muffled acoustic damping.

#### Scenario: Proximity radar visualization
- **WHEN** audible players are within proximity range
- **THEN** the client UI SHALL display their relative distance, direction, and speaking activity on a radar display.

#### Scenario: Speaker block 2D broadcast bypass
- **WHEN** incoming peer audio is flagged with `isBroadcast: true`
- **THEN** the client SHALL route the audio stream directly to master output gain, bypassing the 3D HRTF `PannerNode` to deliver uniform stereo audio across the speaker block's coverage area.
