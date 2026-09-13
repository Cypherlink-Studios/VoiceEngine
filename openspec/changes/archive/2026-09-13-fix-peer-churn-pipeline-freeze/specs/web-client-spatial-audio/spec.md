## ADDED Requirements

### Requirement: Persistent WebRTC Audio Sink and Seamless Stream Lifecycle
The web client SHALL maintain a single persistent audio sink to keep the Chromium WebRTC audio decoding pipeline active, avoiding repeated DOM element instantiation, teardown, and OS audio session re-initialization per peer.

#### Scenario: Persistent dummy audio sink maintenance
- **WHEN** the spatial audio pipeline initializes
- **THEN** the client SHALL maintain a single persistent, muted `<audio>` element bound to a shared MediaStream or dummy sink, preventing audio hardware underruns and WASAPI session thrashing on Windows.

#### Scenario: Distance pausing without Web Audio graph destruction
- **WHEN** an existing peer stream is paused due to distance attenuation or out-of-range culling
- **THEN** the audio pipeline SHALL retain the instantiated audio nodes in an idle or muted state without tearing down or reconstructing PannerNode and MediaStreamAudioSourceNode instances.

#### Scenario: Throttled radar and peer state dispatch
- **WHEN** peer spatial updates or membership changes arrive from the WebSocket
- **THEN** the client SHALL update the audio pipeline in real time and throttle React state dispatches to avoid UI frame drops and avatar asset request storms.
