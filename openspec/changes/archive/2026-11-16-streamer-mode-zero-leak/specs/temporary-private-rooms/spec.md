# temporary-private-rooms Spec Delta

## MODIFIED Requirements

### Requirement: Temporary Room Creation with Random 6-Digit PIN
The system SHALL allow players to create temporary audio rooms either in-game using `/voice room create` or via the web client with an authenticated session, generating a collision-free 6-digit numeric PIN, designating the creator as room owner, and moving the creator into the room, while masking the PIN from visible displays when Streamer Mode is enabled.

#### Scenario: In-game creation outputs clickable PIN
- **WHEN** a player without Streamer Mode enabled executes `/voice room create` in Minecraft
- **THEN** the system generates an active temporary room, sets the player as owner, transfers them to the room channel, and outputs an interactive chat message containing the 6-digit PIN with a click-to-copy action.

#### Scenario: In-game creation masks PIN with Streamer Mode enabled
- **WHEN** a player with Streamer Mode enabled executes `/voice room create` in Minecraft
- **THEN** the system generates the active temporary room and outputs a masked chat message (`PIN hidden`) preserving a `[Copy PIN]` (`copy_to_clipboard`) action without displaying the 6 digits in chat.

#### Scenario: Web client creation moves user into room
- **WHEN** an authenticated user clicks the create room action in the web client
- **THEN** the system generates a 6-digit PIN room, assigns ownership to the user, transitions the client audio session from proximity to the room channel, and displays the PIN (or masked placeholder `••••••` with copy action when Streamer Mode is active).

## ADDED Requirements

### Requirement: Streamer Mode Room PIN Masking
The system SHALL conceal private room PINs in join confirmation chat messages and in the web client room header, drawer, and PIN input field whenever Streamer Mode is enabled.

#### Scenario: In-game room join confirmation omits plaintext PIN
- **WHEN** a player with Streamer Mode enabled joins a temporary room via `/voice room join <pin>`
- **THEN** the chat confirmation message SHALL omit the 6-digit PIN from its rendered text.

#### Scenario: Web client HUD and drawer mask active room PIN
- **WHEN** a connected user has Streamer Mode enabled while inside a temporary private room
- **THEN** the web client top channel tab and room drawer SHALL render the room PIN masked (`••••••`) while keeping click-to-copy functionality and an optional explicit reveal toggle, and SHALL mask the join-room PIN input field.
