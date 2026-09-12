## ADDED Requirements

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
