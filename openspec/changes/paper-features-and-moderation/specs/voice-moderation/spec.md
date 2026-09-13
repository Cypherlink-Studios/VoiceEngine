## Purpose

Provides a centralized moderation engine for VoiceEngine networks, persisting punishments in SQLite, exposing in-game staff commands, enforcing real-time voice restrictions across the SFU, and alerting affected players.

## ADDED Requirements

### Requirement: Staff Moderation Command Suite
The system SHALL provide in-game administrative moderation commands under `/voice` to punish disruptive players across the voice network.

#### Scenario: Staff executes kick on connected player
- **WHEN** an authorized staff member executes `/voice kick <player> [reason]`
- **THEN** the system SHALL immediately terminate the player's active web client session, revoke their current token, and notify the player and staff in chat.

#### Scenario: Staff mutes player voice transmission
- **WHEN** an authorized staff member executes `/voice mute <player> [duration] [reason]`
- **THEN** the system SHALL record an active mute in the database, instruct the voice server to silence the player's audio producer, and inform the player of the mute duration and reason.

#### Scenario: Staff deafens player from receiving audio
- **WHEN** an authorized staff member executes `/voice deafen <player> [duration] [reason]`
- **THEN** the system SHALL record an active deafen in the database, instruct the voice server to pause incoming audio consumers to that player, and inform the player.

#### Scenario: Staff bans player from VoiceEngine
- **WHEN** an authorized staff member executes `/voice ban <player> [duration] [reason]`
- **THEN** the system SHALL record the ban in the database, immediately terminate any active voice session, record the player's IP, and block future token generation for the duration of the ban.

#### Scenario: Staff lifts an active punishment
- **WHEN** an authorized staff member executes `/voice unmute <player>`, `/voice undeafen <player>`, or `/voice unban <player>`
- **THEN** the system SHALL mark the punishment as revoked in the database and notify the voice server to restore full audio capabilities immediately.

#### Scenario: Staff inspects player moderation status
- **WHEN** an authorized staff member executes `/voice modstatus <player>`
- **THEN** the system SHALL query the database and display all active and past punishments, expiration timestamps, executing staff, and reasons for that player.

### Requirement: Punishment Duration Parsing and Expiration
The moderation system SHALL parse human-readable duration strings and automatically treat expired punishments as inactive without requiring manual revocation.

#### Scenario: Valid duration string parsing
- **WHEN** staff specifies duration values using `s` (seconds), `m` (minutes), `h` (hours), `d` (days), or `perm` / `permanent`
- **THEN** the system SHALL calculate the exact Unix epoch millisecond timestamp for expiration or mark it permanent (`0` or `null`).

#### Scenario: Expired punishment evaluation
- **WHEN** the current system time exceeds the punishment's expiration timestamp
- **THEN** queries for active punishments SHALL return inactive, allowing the player to connect or unmute without manual staff intervention.

### Requirement: Centralized Punishment Persistence via SQLite
The moderation system SHALL persist all sanctions in a local SQLite database (`moderation.db`), located in Velocity's data folder when proxy mode is enabled, or Paper's data folder when in standalone mode.

#### Scenario: Transactional recording of punishment
- **WHEN** a moderation action is executed
- **THEN** the system SHALL write a structured record containing punishment ID, player UUID, player username, player IP, action type (MUTE, DEAFEN, BAN), reason, issuer staff UUID/name, creation timestamp, and expiration timestamp.

### Requirement: Real-Time SFU Punishment Synchronization
The system SHALL dispatch real-time WebSocket frames to the voice backend whenever punishments are created, updated, or revoked, and resynchronize active states upon backend reconnection.

#### Scenario: Instantaneous SFU dispatch
- **WHEN** a mute, deafen, kick, or ban is executed in Minecraft
- **THEN** the plugin SHALL transmit a `moderation_action` JSON payload over the backend WebSocket containing the target UUID, action type, active state, and reason.

#### Scenario: Full state synchronization on backend reconnection
- **WHEN** the plugin or proxy establishes or re-establishes its WebSocket connection to the voice backend
- **THEN** it SHALL transmit an `active_punishments_sync` batch containing all currently active bans, mutes, and deafens.

### Requirement: Token Issuance Sanction Enforcement
The system SHALL verify moderation status during token generation requests via `/voice`.

#### Scenario: Banned player attempts voice connection
- **WHEN** a player with an active ban executes `/voice`
- **THEN** the system SHALL refuse to issue a token and display a chat message stating the ban reason, remaining time, and appeal instructions.

#### Scenario: Muted player connects to listen
- **WHEN** a player with an active mute executes `/voice`
- **THEN** the system SHALL issue a token flagged with `isMuted: true` so the voice backend initializes the session with the microphone producer permanently disabled.
