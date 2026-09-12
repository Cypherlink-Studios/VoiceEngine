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

