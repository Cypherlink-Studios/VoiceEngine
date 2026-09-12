## ADDED Requirements

### Requirement: Audio Device Selection and Dynamic Stream Switching
The web client SHALL enumerate audio input and output devices, persist selected device IDs across sessions, and dynamically switch streams at runtime without terminating the WebRTC session.

#### Scenario: Selecting a different input microphone at runtime
- **WHEN** a connected user selects a different microphone device in the settings modal
- **THEN** the client SHALL acquire the new media stream from `navigator.mediaDevices.getUserMedia`, hot-swap the upstream audio track on the active Mediasoup producer, re-bind the VAD analyzer, and persist the choice in `localStorage`.

#### Scenario: Selecting an output playback device
- **WHEN** a user selects an output playback device (speakers or headphones)
- **THEN** the client SHALL route the `AudioContext` destination to the chosen sink via `setSinkId` if supported, fall back gracefully if unsupported, and persist the choice in `localStorage`.

#### Scenario: Audio processing constraint toggling
- **WHEN** a user toggles echo cancellation, noise suppression, or auto gain control in settings
- **THEN** the client SHALL re-acquire the microphone stream applying the updated audio constraints and replace the active producer track.

### Requirement: Per-User Volume Attenuation and Local Mute
The web client SHALL allow listeners to adjust the playback gain of individual peers between 0% and 200% and apply local mutes independently from server-side state.

#### Scenario: Adjusting a specific player volume gain
- **WHEN** a user adjusts the volume slider for a specific player UUID (from the radar, channel drawer, or settings modal)
- **THEN** the client SHALL apply the multiplier to that peer's `GainNode` in the audio pipeline and save the preference in `localStorage`.

#### Scenario: Muting a specific player locally
- **WHEN** a user enables the local mute toggle for a specific player UUID
- **THEN** the client SHALL set that peer's audio gain to zero without impacting other connected listeners or notifying the muted player.

### Requirement: Procedural User Interface Sound Effects
The web client SHALL generate procedural audio feedback chimes using the Web Audio API for interactive voice state transitions without downloading external media files.

#### Scenario: Audio feedback chime on mute state change
- **WHEN** a user mutes or unmutes their microphone
- **THEN** the client SHALL play a distinct procedural sound effect chime if sound effects are enabled.

#### Scenario: Audio feedback chime on channel transition
- **WHEN** a user switches between proximity chat and a fixed voice channel
- **THEN** the client SHALL play a distinct transitional sound effect chime.

### Requirement: Keyboard Shortcuts and Accessibility Navigation
The web client SHALL provide keyboard shortcut bindings for essential voice actions with text-input guardrails and modal dismissal.

#### Scenario: Toggling mute via keyboard shortcut
- **WHEN** a user presses the `M` key while the document focus is not on an editable text input or textarea
- **THEN** the client SHALL toggle microphone mute state and trigger the corresponding audio feedback.

#### Scenario: Dismissing modals and overlays via Escape
- **WHEN** a user presses the `Escape` key while a modal, drawer, or popover is open
- **THEN** the client SHALL close the active overlay.

### Requirement: Network Latency Monitoring and Visual Quality Indicator
The web client SHALL periodically probe round-trip latency to the voice backend and display an intuitive visual connection health indicator in the control dock.

#### Scenario: Probing round-trip latency and displaying connection health
- **WHEN** the client receives a pong response to its periodic ping probe
- **THEN** the client SHALL calculate the round-trip time in milliseconds and render a color-coded status badge in the control dock.
