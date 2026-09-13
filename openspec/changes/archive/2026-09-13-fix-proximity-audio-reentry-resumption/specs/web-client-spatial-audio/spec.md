## MODIFIED Requirements

### Requirement: Persistent WebRTC Audio Sink and Seamless Stream Lifecycle
The web client SHALL maintain an active WebRTC audio sink and resilient source node lifecycle to prevent Chromium audio decoder stalls, avoiding repeated DOM element thrashing per peer while guaranteeing seamless audio resumption upon proximity re-entry.

#### Scenario: Persistent dummy audio sink maintenance
- **WHEN** the spatial audio pipeline initializes
- **THEN** the client SHALL maintain a single persistent `<audio>` element with an inaudible volume level (`volume = 0.0001`) attached to remote streams, preventing audio hardware underruns and WASAPI thrashing while keeping Chromium WebRTC audio decoding active in the background.

#### Scenario: Distance pausing without Web Audio graph destruction
- **WHEN** an existing peer stream is paused due to distance attenuation or out-of-range culling
- **THEN** the audio pipeline SHALL smoothly ramp that peer's `GainNode` to zero and retain the instantiated audio nodes (HRTF PannerNode, BiquadFilterNode) without destroying the spatial graph.

#### Scenario: Atomic source node reconnection upon resumption or track unmuting
- **WHEN** a peer spatial update signals `isPaused: false` or the peer's `MediaStreamTrack` emits an `unmute` event after an inaudible pause period
- **THEN** the audio pipeline SHALL atomically re-instantiate only the `MediaStreamAudioSourceNode` for that peer's track and reconnect it to the existing filter/panner/gain graph, bypassing Chromium's Web Audio unmuted-silence stall while preserving the HRTF convolution state.

#### Scenario: Background AudioContext state recovery
- **WHEN** spatial updates arrive while the browser `AudioContext` is suspended due to background tab throttling or user inactivity
- **THEN** the pipeline SHALL automatically invoke `resume()` on the `AudioContext` to restore active clock progression and audio sample processing.

#### Scenario: Throttled radar and peer state dispatch
- **WHEN** peer spatial updates or membership changes arrive from the WebSocket
- **THEN** the client SHALL update the audio pipeline in real time and throttle React state dispatches to avoid UI frame drops and avatar asset request storms.
