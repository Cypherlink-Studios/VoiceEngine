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
The plugin SHALL maintain a persistent authenticated WebSocket connection with the voice backend and stream player coordinates, orientation, sneaking state, submersion state, and the server identifier at a configurable interval between 10 Hz and 15 Hz.

#### Scenario: Batched coordinate telemetry transmission
- **WHEN** the plugin's telemetry scheduler interval fires (every 66ms to 100ms)
- **THEN** the plugin SHALL aggregate the X, Y, Z coordinates, yaw, pitch, world identifier, configured server identifier (serverId), sneaking state, and water submersion state of all active players and transmit the payload as a JSON batch over WebSocket.

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
The plugin SHALL provide a `/voice reload` command restricted to administrators that hot-reloads all configuration settings, rebinds backend connections, refreshes token TTL, and updates message bundles without restarting the server.

#### Scenario: Admin reloads configuration and messages
- **WHEN** an administrator with `voiceengine.admin.reload` executes `/voice reload`
- **THEN** the plugin SHALL reload `config.yml` and all language bundles, terminate and cleanly re-authenticate the backend WebSocket client with updated `server-id`, `secret-key`, and URI headers, update runtime token TTL in `TokenManager`, reschedule telemetry tasks if `tick-rate-hz` changed, reload speaker configurations, and confirm success in chat.

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

### Requirement: Proxy Mode Delegation and Server Identification
The plugin SHALL support a configurable server-id and proxy-mode setting to operate seamlessly behind a network proxy.

#### Scenario: Running in proxy mode disables local voice onboarding
- **WHEN** proxy-mode is enabled (or automatically detected via Velocity modern forwarding)
- **THEN** the Paper plugin SHALL suppress registering the local /voice command and suppress join welcome notifications, delegating onboarding to the Velocity proxy.

#### Scenario: Running in standalone mode preserves local onboarding
- **WHEN** proxy-mode is disabled and standalone mode is active
- **THEN** the Paper plugin SHALL register the /voice command and send join notifications normally.

### Requirement: Player Presence Binding on Disconnect
The Paper plugin SHALL immediately notify the voice backend when a player leaves the server in standalone mode to terminate any orphaned web client sessions.

#### Scenario: Player disconnects from standalone Paper server
- **WHEN** an online player disconnects from Minecraft (`PlayerQuitEvent`) while standalone mode is active
- **THEN** the plugin SHALL transmit a `player_quit` message over WebSocket to the voice server specifying the player's UUID.

### Requirement: Speaker Block Telemetry Streaming
The Paper plugin SHALL include active speaker block descriptors within periodic spatial telemetry batches sent to the voice backend.

#### Scenario: Telemetry batch includes active speaker blocks
- **WHEN** the telemetry streaming scheduler fires
- **THEN** the transmitted `telemetry_batch` payload SHALL include a `speakers` array containing ID, coordinates, world, serverId, radius, linked player UUID, and active power state for all registered speaker blocks.

### Requirement: Universal Multi-Version Minecraft Compatibility (1.20.0 - 1.21.4)
The Paper plugin SHALL be packaged as a single universal binary compiled for Java 17 bytecode targeting `api-version: '1.20'`, capable of loading and functioning on Paper servers from version 1.20.0 through 1.21.4 without requiring version-specific builds.

#### Scenario: Plugin loading on Java 17 and Minecraft 1.20.x servers
- **WHEN** the plugin JAR is placed in the plugins folder of a Paper server running Minecraft 1.20.0 through 1.20.4 on a Java 17 runtime
- **THEN** the server SHALL successfully load and enable the plugin without `UnsupportedClassVersionError` or `ClassNotFoundException`.

#### Scenario: Plugin loading on Java 21 and Minecraft 1.21.x servers
- **WHEN** the plugin JAR is placed in the plugins folder of a Paper server running Minecraft 1.21.x on a Java 21 runtime
- **THEN** the server SHALL successfully load and enable the plugin without version rejection or compatibility errors.

#### Scenario: Universal command execution and dispatch
- **WHEN** an in-game player or console administrator executes any VoiceEngine command (`/voice`, `/audio`, `/speaker`) on either a 1.20.x or 1.21.x Paper server
- **THEN** the command SHALL execute successfully using standard command sender dispatch without relying on server-version-restricted `CommandSourceStack` classes.

#### Scenario: Dynamic tab-completion and suggestion registration
- **WHEN** the plugin initializes its command manager on a running Paper server
- **THEN** the plugin SHALL negotiate available capabilities, enabling native Brigadier completion if supported, asynchronous tab completions if supported, or falling back gracefully to standard Bukkit completions.

### Requirement: Configurable In-Game Mechanics and Feature Toggles
The plugin SHALL allow administrators to independently enable or disable sneak whispering, underwater acoustics, player speaking particles, spectator voice policies, and speaker blocks via `config.yml`, applying updates dynamically upon `/voice reload`.

#### Scenario: Disabling sneak whisper attenuation
- **WHEN** `mechanics.whisper-on-sneak` is set to `false` in configuration
- **THEN** the plugin SHALL transmit `isSneaking` as `false` in spatial telemetry regardless of whether the player is crouching in Minecraft.

#### Scenario: Disabling underwater muffled acoustics
- **WHEN** `mechanics.underwater-acoustics` is set to `false` in configuration
- **THEN** the plugin SHALL transmit `isSubmerged` as `false` in spatial telemetry regardless of whether the player is in water.

#### Scenario: Disabling player speaking particles
- **WHEN** `mechanics.speaking-particles` is set to `false` in configuration
- **THEN** the plugin SHALL suppress spawning musical note particles above speaking players' heads upon receiving voice activity notifications.

#### Scenario: Enforcing spectator voice mode
- **WHEN** `mechanics.spectator-mode` is configured to `listen-only` or `isolated` and an online player enters spectator game mode or dies
- **THEN** the plugin SHALL tag the player's spatial telemetry state as a spectator so the voice backend applies the configured spectator isolation policy.

#### Scenario: Disabling speaker blocks system
- **WHEN** `speakers.enabled` is set to `false` in configuration
- **THEN** the plugin SHALL disable speaker block ticking, persistence, and reject `/voice speaker` commands with a feature disabled notification.

#### Scenario: Dynamic mechanics configuration reload
- **WHEN** an administrator modifies `mechanics` or `speakers` in `config.yml` and executes `/voice reload`
- **THEN** the plugin SHALL immediately reload and apply the updated feature toggles without restarting the server.



