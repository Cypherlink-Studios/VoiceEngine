# paper-voice-bridge Specification

## Purpose
Enables Paper Minecraft servers to integrate with the proximity voice backend by tracking player positions, generating secure web session tokens, and displaying in-game voice indicators.

## Requirements

### Requirement: Authentication Token Generation and Dispatch
The plugin SHALL provide a `/voice` command and automatic welcome notification that generates cryptographically secure, short-lived one-time tokens and provides a clickable URL in chat for web client onboarding.

#### Scenario: Player requests voice connection link
- **WHEN** an online player executes `/voice` in game
- **THEN** the plugin SHALL generate a one-time connection token associated with the player's UUID and send a clickable chat message linking directly to the web client with the token.

#### Scenario: Expired token rejection
- **WHEN** a player attempts to redeem a connection token after its configured time-to-live has elapsed
- **THEN** the system SHALL reject the authentication attempt and prompt the player to generate a new token via `/voice`.

### Requirement: Spatial Position and State Telemetry Streaming
The plugin SHALL maintain a persistent authenticated WebSocket connection with the voice backend and stream player coordinates, orientation, sneaking state, and submersion state at a configurable interval between 10 Hz and 15 Hz.

#### Scenario: Batched coordinate telemetry transmission
- **WHEN** the plugin's telemetry scheduler interval fires (every 66ms to 100ms)
- **THEN** the plugin SHALL aggregate the X, Y, Z coordinates, yaw, pitch, world identifier, sneaking state, and water submersion state of all active players and transmit the payload as a JSON batch over WebSocket.

#### Scenario: Automatic connection recovery
- **WHEN** the WebSocket connection to the voice backend is lost or closed unexpectedly
- **THEN** the plugin SHALL log a warning, initiate automatic reconnection attempts with backoff, and resume telemetry streaming upon re-establishing the socket.

### Requirement: In-Game Speech Visual Feedback
The plugin SHALL receive voice activity state notifications from the voice backend and display subtle visual particle indicators in-game to show who is speaking.

#### Scenario: Player begins speaking
- **WHEN** the voice backend broadcasts an active speech event for a connected player UUID
- **THEN** the plugin SHALL spawn subtle particle effects (such as musical note particles) above that player's head visible to nearby players in the same dimension.

#### Scenario: Player stops speaking
- **WHEN** the voice backend signals that a player has stopped speaking
- **THEN** the plugin SHALL cease spawning speaking particles for that player.

### Requirement: Administrative In-Game Command and Token Dispatch
The plugin SHALL provide a `/voice admin` command restricted by permission that generates administrative session tokens linking to the web client admin portal, while validating backend connectivity.

#### Scenario: Admin player generates portal link
- **WHEN** a player with the `voiceengine.admin` permission executes `/voice admin` while the voice backend is connected
- **THEN** the plugin SHALL generate a one-time administrative token, register it with the backend, and send a clickable chat URL targeting `/admin?token=<TOKEN>`.

#### Scenario: Non-admin player attempts access
- **WHEN** a player without the `voiceengine.admin` permission executes `/voice admin`
- **THEN** the plugin SHALL reject the command with a permission denied error message.

#### Scenario: Backend disconnected during admin command
- **WHEN** a player with the `voiceengine.admin` permission executes `/voice admin` while the voice backend WebSocket is disconnected or closed
- **THEN** the plugin SHALL inform the player that the VoiceEngine backend is offline and abort token dispatch.

### Requirement: Multi-Locale Message Localization (i18n)
The plugin SHALL resolve messages in the player's client language locale with fallback to the configured default server locale, formatted using Adventure MiniMessage.

#### Scenario: Player with matching locale receives localized message
- **WHEN** a player with client locale `es_es` executes `/voice` or joins the server
- **THEN** the plugin SHALL deliver messages rendered from the Spanish language resource bundle formatted via MiniMessage.

#### Scenario: Player with unsupported locale falls back to default
- **WHEN** a player with an unsupported client locale receives a plugin message
- **THEN** the plugin SHALL fall back to the configured default server locale bundle (e.g. `en_US`) and deliver the message without failure.

### Requirement: Configuration and Language Live Reload
The plugin SHALL provide a `/voice reload` command restricted to administrators that hot-reloads configuration and message bundles without restarting the server.

#### Scenario: Admin reloads configuration and messages
- **WHEN** an administrator with `voiceengine.admin.reload` executes `/voice reload`
- **THEN** the plugin SHALL reload `config.yml` and all language bundles, apply updated runtime settings, and confirm success in chat.

#### Scenario: Non-admin attempts reload
- **WHEN** a player without `voiceengine.admin.reload` executes `/voice reload`
- **THEN** the command SHALL be rejected with an access denied message rendered in the player's locale.

### Requirement: Backend Diagnostics and Status Inspection
The plugin SHALL provide a `/voice status` command to report backend connection health, latency, and session counts.

#### Scenario: Admin inspects status
- **WHEN** an administrator with `voiceengine.admin.status` executes `/voice status`
- **THEN** the plugin SHALL display whether the WebSocket is connected, connection URI, reconnect attempt count, and count of active tokens.

#### Scenario: Non-admin attempts status inspection
- **WHEN** a player without `voiceengine.admin.status` executes `/voice status`
- **THEN** the command SHALL be rejected with an access denied message rendered in the player's locale.

### Requirement: Public Developer API and Paper Events
The plugin SHALL expose a public API service and dispatch custom Paper events to enable third-party plugins to integrate with VoiceEngine.

#### Scenario: Third-party plugin queries voice connection
- **WHEN** an external plugin calls `VoiceEngineAPI#isConnected(UUID)` or `VoiceEngineAPI#isSpeaking(UUID)`
- **THEN** the plugin SHALL return the current cached voice connectivity and speech state for that player.

#### Scenario: Third-party plugin listens to speaking state change
- **WHEN** a player starts or stops speaking as signaled by the voice backend
- **THEN** the plugin SHALL fire a `PlayerSpeakingStateChangeEvent` on the Bukkit event bus.

