# Spec Delta

## Purpose

Provides ephemeral private audio rooms isolated from proximity 3D chat, secured by random 6-digit PINs, supporting member moderation and covert staff eavesdropping.

## ADDED Requirements

### Requirement: Temporary Room Creation with Random 6-Digit PIN
The system SHALL allow players to create temporary audio rooms either in-game using `/voice room create` or via the web client with an authenticated session, generating a collision-free 6-digit numeric PIN, designating the creator as room owner, and moving the creator into the room.

#### Scenario: In-game creation outputs clickable PIN
- **WHEN** a player executes `/voice room create` in Minecraft
- **THEN** the system generates an active temporary room, sets the player as owner, transfers them to the room channel, and outputs an interactive chat message containing the 6-digit PIN with a click-to-copy action.

#### Scenario: Web client creation moves user into room
- **WHEN** an authenticated user clicks the create room action in the web client
- **THEN** the system generates a 6-digit PIN room, assigns ownership to the user, transitions the client audio session from proximity to the room channel, and displays the PIN prominently.

### Requirement: Rate-Limited Room Joining via 6-Digit PIN
The system SHALL validate 6-digit PIN join requests submitted in-game (`/voice room join <pin>`) or via web client, enforcing a rate limit of at most 5 failed attempts per minute per player or IP address before temporarily locking attempts for 60 seconds.

#### Scenario: Successful join with valid PIN
- **WHEN** a player submits a valid 6-digit PIN and the room has not exceeded capacity
- **THEN** the system moves the player into the room channel and notifies existing room members.

#### Scenario: Rate limit lockout on repeated invalid PINs
- **WHEN** a player or IP submits 5 invalid PIN attempts within a 60-second window
- **THEN** the system blocks subsequent join attempts for 60 seconds and returns a rate-limit error message.

### Requirement: Stereo Unspatialized Audio Isolation
The system SHALL route WebRTC audio between room members in stereo without distance attenuation or 3D positional spatialization, isolating members completely from proximity audio.

#### Scenario: Room audio bypasses 3D HRTF panners
- **WHEN** a member speaks inside a temporary private room
- **THEN** all other members in that room receive unattenuated stereo audio without 3D directional panning or distance falloff.

#### Scenario: Proximity audio suppressed while in room
- **WHEN** a player is inside a temporary private room
- **THEN** they neither transmit proximity audio to nearby world players nor receive proximity audio from nearby world players.

### Requirement: Room Member Moderation and Kicking
The system SHALL allow the room owner to kick members from the room in-game (`/voice room kick <player>`) or via the web client roster, returning the kicked member to proximity chat.

#### Scenario: Owner kicks member via command
- **WHEN** the room owner executes `/voice room kick <player>` for an active member
- **THEN** the target player is removed from the room, returned to proximity mode, and notified of the expulsion.

#### Scenario: Non-owner kick attempt rejected
- **WHEN** a non-owner member attempts to kick another player
- **THEN** the system rejects the action with a permission error.

### Requirement: Room Lifecycle and Automatic Destruction
The system SHALL maintain temporary rooms in memory, automatically transferring ownership to the next oldest member if the owner leaves, and destroying the room after a 30-second grace period when all members depart.

#### Scenario: Ownership transfer upon owner departure
- **WHEN** the room owner leaves the room while other members remain
- **THEN** the system assigns ownership to the longest-standing active member and notifies room participants.

#### Scenario: Empty room destruction after grace period
- **WHEN** the last member leaves a temporary room
- **THEN** the system initiates a 30-second timer and deletes the room and recycles the PIN if no members rejoin before expiration.

### Requirement: Staff Administrative Room Wiretapping
The system SHALL allow authorized staff members with permission `voiceengine.admin.room.spy` to execute `/voice room spy <playerName>`, joining the target player's room in silent eavesdrop mode.

#### Scenario: Covert room wiretap entry
- **WHEN** an authorized staff member executes `/voice room spy <playerName>` for a player in a room
- **THEN** the staff member receives stereo audio from all room members, their microphone is muted towards the room, and their presence is excluded from the room's public roster.

#### Scenario: Staff leaves wiretap
- **WHEN** a staff member executes `/voice room unspy` or `/voice room leave`
- **THEN** the wiretap audio session ends and the staff member returns to standard proximity mode.

### Requirement: Configurable Room Capacity Limit
The system SHALL enforce a maximum concurrent member limit per room configured in Paper's `config.yml`, rejecting join requests when the room is full unless configured as unlimited (`0` or negative).

#### Scenario: Join rejected when room reaches capacity
- **WHEN** a player attempts to join a room whose current member count equals the configured maximum capacity
- **THEN** the system rejects the join request with a room-full notification.
