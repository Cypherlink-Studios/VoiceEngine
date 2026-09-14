## ADDED Requirements

### Requirement: Interactive Tab Completion for Audio Commands
The Paper plugin SHALL provide contextual tab completion and argument suggestions for all administrative audio emitter commands.

#### Scenario: Staff requests suggestions for active emitter ID in lifecycle commands
- **WHEN** staff enters `/voice audio pause `, `/voice audio resume `, `/voice audio volume `, or `/voice audio stop ` and triggers tab completion
- **THEN** the system SHALL suggest the IDs of all registered audio emitters currently in the system.

#### Scenario: Staff requests suggestions for audio stop target
- **WHEN** staff enters `/voice audio stop ` and triggers tab completion
- **THEN** the system SHALL include `all` in addition to active emitter IDs in the suggested completions.

#### Scenario: Staff requests suggestions for cache purge duration
- **WHEN** staff enters `/voice audio cache purge ` and triggers tab completion
- **THEN** the system SHALL suggest common duration presets including `all`, `24h`, `7d`, and `30d`.

#### Scenario: Staff requests suggestions for particle display state
- **WHEN** staff enters `/voice audio particles ` and triggers tab completion
- **THEN** the system SHALL suggest `on`, `off`, and `toggle`.

#### Scenario: Staff requests suggestions for emitter volume
- **WHEN** staff enters `/voice audio volume <id> ` and triggers tab completion
- **THEN** the system SHALL suggest decimal volume presets `0.25`, `0.5`, `0.75`, and `1.0`.
