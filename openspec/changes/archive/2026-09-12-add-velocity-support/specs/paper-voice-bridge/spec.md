# paper-voice-bridge Specification Delta

## MODIFIED Requirements

### Requirement: Spatial Position and State Telemetry Streaming
The plugin SHALL maintain a persistent authenticated WebSocket connection with the voice backend and stream player coordinates, orientation, sneaking state, submersion state, and the server identifier at a configurable interval between 10 Hz and 15 Hz.

#### Scenario: Batched coordinate telemetry transmission
- **WHEN** the plugin's telemetry scheduler interval fires (every 66ms to 100ms)
- **THEN** the plugin SHALL aggregate the X, Y, Z coordinates, yaw, pitch, world identifier, configured server identifier (serverId), sneaking state, and water submersion state of all active players and transmit the payload as a JSON batch over WebSocket.

#### Scenario: Automatic connection recovery
- **WHEN** the WebSocket connection to the voice backend is lost or closed unexpectedly
- **THEN** the plugin SHALL log a warning, initiate automatic reconnection attempts with backoff, and resume telemetry streaming upon re-establishing the socket.

## ADDED Requirements

### Requirement: Proxy Mode Delegation and Server Identification
The plugin SHALL support a configurable server-id and proxy-mode setting to operate seamlessly behind a network proxy.

#### Scenario: Running in proxy mode disables local voice onboarding
- **WHEN** proxy-mode is enabled (or automatically detected via Velocity modern forwarding)
- **THEN** the Paper plugin SHALL suppress registering the local /voice command and suppress join welcome notifications, delegating onboarding to the Velocity proxy.

#### Scenario: Running in standalone mode preserves local onboarding
- **WHEN** proxy-mode is disabled and standalone mode is active
- **THEN** the Paper plugin SHALL register the /voice command and send join notifications normally.
