## ADDED Requirements

### Requirement: Interactive Tab Completion for Speaker Commands
The Paper plugin SHALL provide contextual tab completion and argument suggestions for all administrative speaker block commands.

#### Scenario: Staff requests suggestions for existing speaker IDs
- **WHEN** staff enters `/voice speaker remove `, `/voice speaker link `, `/voice speaker unlink `, `/voice speaker redstone `, `/voice speaker play `, or `/voice speaker stop ` and triggers tab completion
- **THEN** the system SHALL suggest the IDs of all currently registered speaker blocks.

#### Scenario: Staff requests suggestions for online player when linking speaker
- **WHEN** staff enters `/voice speaker link <id> ` and triggers tab completion
- **THEN** the system SHALL suggest the usernames of all online players on the Paper server.

#### Scenario: Staff requests suggestions for media sources on speaker block
- **WHEN** staff enters `/voice speaker play <id> ` and triggers tab completion
- **THEN** the system SHALL suggest the relative paths of all available media files in the server media folder.

#### Scenario: Staff requests suggestions for redstone requirement
- **WHEN** staff enters `/voice speaker redstone <id> ` and triggers tab completion
- **THEN** the system SHALL suggest `true` and `false`.
