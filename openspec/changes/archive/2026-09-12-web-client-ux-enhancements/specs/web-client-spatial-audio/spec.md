## ADDED Requirements

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
