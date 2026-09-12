## ADDED Requirements

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
