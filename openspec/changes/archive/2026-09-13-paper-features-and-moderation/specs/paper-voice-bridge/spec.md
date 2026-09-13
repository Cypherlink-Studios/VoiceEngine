## MODIFIED Requirements

### Requirement: Configuration and Language Live Reload
The plugin SHALL provide a `/voice reload` command restricted to administrators that hot-reloads all configuration settings, rebinds backend connections, refreshes token TTL, and updates message bundles without restarting the server.

#### Scenario: Admin reloads configuration and messages
- **WHEN** an administrator with `voiceengine.admin.reload` executes `/voice reload`
- **THEN** the plugin SHALL reload `config.yml` and all language bundles, terminate and cleanly re-authenticate the backend WebSocket client with updated `server-id`, `secret-key`, and URI headers, update runtime token TTL in `TokenManager`, reschedule telemetry tasks if `tick-rate-hz` changed, reload speaker configurations, and confirm success in chat.

#### Scenario: Non-admin attempts reload
- **WHEN** a player without `voiceengine.admin.reload` executes `/voice reload`
- **THEN** the command SHALL be rejected with an access denied message rendered in the player's locale.

## ADDED Requirements

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
