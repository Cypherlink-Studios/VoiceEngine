# Spec Delta

## MODIFIED Requirements

### Requirement: Enhanced Radar with Minecraft Head Skins
The radar display SHALL render player Minecraft head skins retrieved by player UUID and display relative elevation indicators within a minimalist spatial soundstage.

#### Scenario: Rendering player skin and elevation
- **WHEN** a nearby player appears on the proximity radar
- **THEN** the soundstage SHALL render their circular Minecraft avatar head, indicate relative elevation relative to the listener, display subtle concentric glass distance rings, and emit an expanding soft pulse ring around their avatar when they are actively speaking.

#### Scenario: Server radar restriction policy and proximity roster
- **WHEN** the backend voice server signals that player radar is disabled for the current server
- **THEN** the web client SHALL suppress the circular radar soundstage and render a proximity presence roster displaying audible players, avatar heads, speaking pulse indicators, and individual volume sliders without directional compass cues or distance rings.

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

#### Scenario: Picture-in-Picture display when radar is disabled
- **WHEN** Document Picture-in-Picture is active and the current server has disabled the proximity radar
- **THEN** the floating overlay window SHALL render a compact proximity roster displaying speaking avatars and voice indicators instead of the circular radar dish.
