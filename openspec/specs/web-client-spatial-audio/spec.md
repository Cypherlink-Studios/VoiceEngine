# web-client-spatial-audio Specification

## Purpose
Delivers a zero-mod web interface that captures microphone audio with voice activity detection, renders 3D binaural spatialized audio, and visualizes nearby players.

## Requirements

### Requirement: One-Click Connection and Microphone Acquisition
The web client SHALL support instant onboarding through URL tokens, acquiring microphone input and establishing the WebRTC audio session upon a single user interaction.

#### Scenario: One-click session initialization
- **WHEN** a player opens the web client via the link provided in-game and clicks the connect button
- **THEN** the client SHALL initialize the browser AudioContext, request microphone media access, and initiate WebRTC negotiation with the SFU.

#### Scenario: Player avatar and identity display
- **WHEN** session credentials are authenticated by the backend
- **THEN** the client UI SHALL display the user's Minecraft username, avatar render, and connection latency.

### Requirement: Voice Activity Detection (VAD) and Input Management
The client SHALL process local microphone input using client-side Voice Activity Detection (VAD), transmitting audio only when speech is detected and providing user-configurable sensitivity.

#### Scenario: Voice activation threshold exceeded
- **WHEN** input audio levels cross above the user-configured VAD threshold
- **THEN** the client SHALL unmute the upstream media track, transmit audio packets, and notify the backend of active speech.

#### Scenario: Silence and hangover duration
- **WHEN** input volume drops below the VAD threshold for longer than the hangover period (e.g. 250ms)
- **THEN** the client SHALL mute or pause the upstream track to eliminate background noise.

### Requirement: Binaural 3D Spatial Audio Rendering
The web client SHALL process incoming peer audio streams through the Web Audio API using HRTF `PannerNode` instances positioned according to in-game relative coordinates and orientations.

#### Scenario: Dynamic 3D positional positioning
- **WHEN** a relative position packet is received for an audible peer
- **THEN** the client SHALL interpolate and apply the X, Y, and Z offsets to that peer's `PannerNode` relative to the local listener's yaw and pitch.

#### Scenario: Submerged low-pass acoustic filtering
- **WHEN** spatial telemetry flags that either the listener or speaker is submerged in water
- **THEN** the client SHALL route the incoming stream through a BiquadFilterNode configured as a low-pass filter to produce muffled acoustic damping.

#### Scenario: Proximity radar visualization
- **WHEN** audible players are within proximity range
- **THEN** the client UI SHALL display their relative distance, direction, and speaking activity on a radar display.

### Requirement: Dual-Mode Audio Switching (Proximity vs Fixed Channels)
The web client SHALL support switching between 3D spatialized proximity chat and unattenuated stereo fixed channels.

#### Scenario: Switching to a fixed channel
- **WHEN** a player selects a fixed channel from the channel drawer
- **THEN** the client SHALL switch incoming audio routing to unspatialized stereo, bypass the 3D panner, and attenuate or mute proximity audio.

#### Scenario: Switching back to proximity
- **WHEN** a player selects the proximity channel
- **THEN** the client SHALL reactivate 3D HRTF spatial panners and distance attenuation according to in-game coordinates.

### Requirement: Reactive Audio Waveform Visualizer
The web client SHALL render a real-time reactive audio waveform in the control dock to visualize microphone audio levels and speech activity.

#### Scenario: Speech audio waveform rendering
- **WHEN** local microphone input detects active speech
- **THEN** the UI SHALL animate a dynamic audio wave indicating volume and voice activity.

### Requirement: Enhanced Radar with Minecraft Head Skins
The radar display SHALL render player Minecraft head skins retrieved by player UUID and display relative elevation indicators.

#### Scenario: Rendering player skin and elevation
- **WHEN** a nearby player appears on the proximity radar
- **THEN** the radar SHALL render their Minecraft avatar head and indicate whether they are above, level with, or below the listener's elevation.

### Requirement: Dynamic Brand Theme Application
The web client SHALL query `/api/config/public` upon loading and dynamically apply configured colors, logos, titles, and background assets.

#### Scenario: Brand styling initialization
- **WHEN** the web client loads
- **THEN** it SHALL fetch the public brand configuration and apply the primary and accent colors to CSS variables and render server branding.

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

### Requirement: Document Picture-in-Picture Floating Overlay
The web client SHALL support launching an always-on-top floating native window using the Document Picture-in-Picture API, rendering real-time radar and essential voice controls without requiring browser window focus.

#### Scenario: Launching floating overlay window
- **WHEN** a connected user clicks the "Floating Overlay" button on a browser supporting Document Picture-in-Picture
- **THEN** the client SHALL open a native floating window containing a compact radar, speaking indicators, latency status, and mute/deafen toggle controls while mirroring styling and active state.

#### Scenario: Graceful fallback when Picture-in-Picture is unsupported
- **WHEN** a user is running a browser without Document Picture-in-Picture support
- **THEN** the client SHALL hide the overlay trigger or display an informative tooltip indicating browser incompatibility without errors.

#### Scenario: Bi-directional state synchronization
- **WHEN** a user toggles mute or deafen from inside the floating overlay window
- **THEN** the primary tab SHALL immediately reflect the state change and apply the corresponding audio mutations and sound effects.

### Requirement: Mobile Companion Integration and Screen Wake Lock
The web client SHALL provide mobile companion utilities including instant QR code session transfer, screen wake lock retention, and tactile haptic feedback.

#### Scenario: Displaying session QR code for mobile companion
- **WHEN** a user opens the mobile companion drawer or modal
- **THEN** the client SHALL generate and render a scannable QR code encoding the direct URL with the active session token.

#### Scenario: Acquiring and maintaining screen wake lock
- **WHEN** the web client connects on a mobile device supporting the Screen Wake Lock API
- **THEN** the client SHALL request a screen wake lock to prevent the device display from sleeping during an active voice session, releasing the lock upon disconnection.

#### Scenario: Haptic feedback vibration on voice toggles
- **WHEN** a user toggles mute or deafen on a device supporting `navigator.vibrate`
- **THEN** the client SHALL emit a short tactile vibration pulse (e.g. 30ms-50ms).

### Requirement: Microphone Diagnostic Loopback and Visual Calibration
The web client SHALL provide a real-time self-monitoring loopback mechanism with visual level metering to verify input quality and calibrate voice activity thresholds.

#### Scenario: Starting microphone loopback test
- **WHEN** a user activates the "Mic Test" toggle within the settings modal
- **THEN** the client SHALL route the local microphone stream through a delay buffer into the local audio output without transmitting to the SFU or remote peers.

#### Scenario: Visual VAD threshold feedback
- **WHEN** speaking during the mic test
- **THEN** the UI SHALL render an input meter indicating current RMS amplitude alongside the configured VAD threshold marker to clearly signal when speech triggers transmission.

### Requirement: Deafen Mode and Incoming Audio Suppression
The web client SHALL support a global deafen mode that simultaneously mutes local microphone transmission and silences all incoming audio streams.

#### Scenario: Toggling deafen mode via UI and keyboard shortcut
- **WHEN** a user clicks the deafen button or presses the `D` key while focus is outside of a text input
- **THEN** the client SHALL toggle deafen state, setting master incoming audio gain to zero and muting the microphone producer track.

#### Scenario: Procedural deafen audio feedback
- **WHEN** deafen state is enabled or disabled
- **THEN** the client SHALL play a distinct procedural audio chime indicating the state transition.

### Requirement: Streamer Privacy Masking Mode
The web client SHALL provide a streamer mode toggle that conceals sensitive server details, tokens, and coordinates from UI displays.

#### Scenario: Masking sensitive tokens and coordinates
- **WHEN** streamer mode is enabled
- **THEN** the client SHALL mask the join token, session URL parameters, server hostnames, and exact relative coordinates in player inspection popovers with obfuscated placeholders.

### Requirement: Interactive Radar Peer Control and Radio Audio Ducking
The web client SHALL allow direct interaction with peers on the proximity radar and support automatic attenuation of proximity chat when active speech occurs on a fixed radio channel.

#### Scenario: Quick peer popover interaction from radar avatar click
- **WHEN** a user clicks on an avatar icon on the proximity radar
- **THEN** the client SHALL open the volume and mute popover anchored to that specific player.

#### Scenario: Proximity audio ducking during radio channel speech
- **WHEN** audio packets are received from a peer speaking in an active fixed radio channel while proximity audio is enabled
- **THEN** the client SHALL temporarily attenuate proximity audio volume by 50% for the duration of the radio transmission.

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



