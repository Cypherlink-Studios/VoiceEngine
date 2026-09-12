## ADDED Requirements

### Requirement: Administrative In-Game Command and Token Dispatch
The plugin SHALL provide a `/voice admin` command restricted by permission that generates administrative session tokens linking to the web client admin portal.

#### Scenario: Admin player generates portal link
- **WHEN** a player with the `voiceengine.admin` permission executes `/voice admin`
- **THEN** the plugin SHALL generate a one-time administrative token and send a clickable chat URL targeting `/admin?token=<TOKEN>`.

#### Scenario: Non-admin player attempts access
- **WHEN** a player without the `voiceengine.admin` permission executes `/voice admin`
- **THEN** the plugin SHALL reject the command with a permission denied error message.
