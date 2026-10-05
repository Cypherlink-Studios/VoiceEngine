# Spec Delta: web-client-spatial-audio

## MODIFIED Requirements

### Requirement: Reactive Audio Waveform Visualizer
The web client SHALL render a real-time reactive audio visualizer in the control dock to visualize microphone audio levels and speech activity.

#### Scenario: Speech audio waveform rendering
- **WHEN** local microphone input detects active speech
- **THEN** the UI SHALL animate discrete vertical equalizer bars in the control dock capsule that oscillate smoothly according to speech amplitude, resting at a subtle baseline height during silence or while muted.

### Requirement: Enhanced Radar with Minecraft Head Skins
The radar display SHALL render player Minecraft head skins retrieved by player UUID and display relative elevation indicators within a minimalist spatial soundstage.

#### Scenario: Rendering player skin and elevation
- **WHEN** a nearby player appears on the proximity radar
- **THEN** the soundstage SHALL render their circular Minecraft avatar head, indicate relative elevation relative to the listener, display subtle concentric glass distance rings, and emit an expanding soft pulse ring around their avatar when they are actively speaking.

### Requirement: Dual-Mode Audio Switching (Proximity vs Fixed Channels)
The web client SHALL support switching between 3D spatialized proximity chat and unattenuated stereo fixed channels via an integrated segmented pill control.

#### Scenario: Switching to a fixed channel
- **WHEN** a player selects a fixed channel tab from the top segmented control
- **THEN** the client SHALL switch incoming audio routing to unspatialized stereo, bypass the 3D panner, attenuate or mute proximity audio, and transition the center view from the 3D soundstage to the channel participant list.

#### Scenario: Switching back to proximity
- **WHEN** a player selects the proximity channel tab
- **THEN** the client SHALL reactivate 3D HRTF spatial panners and distance attenuation according to in-game coordinates, transitioning back to the 3D soundstage.

### Requirement: Network Latency Monitoring and Visual Quality Indicator
The web client SHALL periodically probe round-trip latency to the voice backend and display an intuitive visual connection health indicator in the control dock.

#### Scenario: Probing round-trip latency and displaying connection health
- **WHEN** the client receives a pong response to its periodic ping probe
- **THEN** the client SHALL calculate the round-trip time in milliseconds and render a color-coded status badge in the control dock or header overlay.

## ADDED Requirements

### Requirement: Dynamic Glass Capsule ControlDock and Quick Audio Popover
The web client SHALL render an Apple-inspired frosted-glass floating control capsule with dedicated quick sound and utility action popovers.

#### Scenario: Smart microphone button state feedback
- **WHEN** the microphone is active and the user is speaking
- **THEN** the microphone button SHALL display a soft emerald breathing ring and background accent without high-saturation neon glow.

#### Scenario: Microphone mute state feedback
- **WHEN** the microphone is muted by the user
- **THEN** the microphone button SHALL display a desaturated ruby/coral frosted glass styling with a clear slash icon.

#### Scenario: Quick sound popover activation
- **WHEN** the user interacts with the sound volume button in the control capsule
- **THEN** a floating frosted-glass popover card SHALL emerge above the dock containing master volume slider, VAD threshold sensitivity slider, and AI noise suppression toggle.

#### Scenario: Quick utility actions menu activation
- **WHEN** the user interacts with the more actions button (`...`) in the control capsule
- **THEN** a floating actions menu SHALL open containing Document Picture-in-Picture trigger, mobile QR companion link, full settings modal trigger, and disconnect button.
