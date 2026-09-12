## MODIFIED Requirements

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
