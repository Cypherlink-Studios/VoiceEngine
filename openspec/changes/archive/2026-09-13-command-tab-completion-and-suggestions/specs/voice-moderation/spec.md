## ADDED Requirements

### Requirement: Interactive Tab Completion for Moderation Commands
The moderation command suite SHALL provide contextual tab completion for player usernames and duration strings across the network.

#### Scenario: Staff requests suggestions for player username
- **WHEN** staff enters `/voice-velocity kick `, `/voice-velocity mute `, `/voice-velocity deafen `, `/voice-velocity ban `, `/voice-velocity unmute `, `/voice-velocity undeafen `, `/voice-velocity unban `, or `/voice-velocity modstatus ` and triggers tab completion
- **THEN** the system SHALL suggest the usernames of all connected players on the proxy network.

#### Scenario: Staff requests suggestions for punishment duration
- **WHEN** staff enters `/voice-velocity mute <player> `, `/voice-velocity deafen <player> `, or `/voice-velocity ban <player> ` and triggers tab completion
- **THEN** the system SHALL suggest standard duration presets including `15m`, `30m`, `1h`, `6h`, `12h`, `1d`, `7d`, `30d`, and `permanent`.
