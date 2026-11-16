# paper-voice-bridge Spec Delta

## MODIFIED Requirements

### Requirement: Authentication Token Generation and Dispatch
The plugin SHALL provide a `/voice` command and automatic welcome notification that generates cryptographically secure, short-lived one-time tokens and provides a clickable URL or zero-leak clipboard actions in chat for web client onboarding depending on the player's Streamer Mode preference.

#### Scenario: Player requests voice connection link
- **WHEN** an online player without Streamer Mode enabled executes `/voice` in game
- **THEN** the plugin SHALL generate a one-time connection token associated with the player's UUID and send a clickable chat message linking directly to the web client with the token.

#### Scenario: Player requests voice session with Streamer Mode enabled
- **WHEN** an online player with Streamer Mode enabled executes `/voice` in game
- **THEN** the plugin SHALL suppress printing the plaintext token and tokenized URL in chat and instead render interactive `[Open Web]` (clean base URL without `?token=`), `[Copy Code]` (`copy_to_clipboard` with the token), and `[Copy Link]` (`copy_to_clipboard` with the tokenized URL) actions.

#### Scenario: Expired token rejection
- **WHEN** a player attempts to redeem a connection token after its configured time-to-live has elapsed
- **THEN** the system SHALL reject the authentication attempt and prompt the player to generate a new token via `/voice`.

#### Scenario: Token registration incorporates originating server identifier
- **WHEN** a player generates a session token via `/voice` or `/voice admin`
- **THEN** the plugin SHALL dispatch a `register_token` frame over WebSocket to the voice server containing `token`, `playerUuid`, `playerName`, `expiresAt`, `isAdmin`, the configured `serverId`, and the player's `streamerMode` state (indicating whether an explicit server-side preference exists).

### Requirement: Administrative In-Game Command and Token Dispatch
The plugin SHALL provide a `/voice admin` command restricted by permission that generates administrative session tokens linking to the web client admin portal, while validating backend connectivity and respecting Streamer Mode masking.

#### Scenario: Admin player generates portal link
- **WHEN** a player with the `voiceengine.admin` permission and Streamer Mode disabled executes `/voice admin` while the voice backend is connected
- **THEN** the plugin SHALL generate a one-time administrative token, register it with the backend, and send a clickable chat URL targeting `/admin?token=<TOKEN>`.

#### Scenario: Admin player generates portal link with Streamer Mode enabled
- **WHEN** a player with the `voiceengine.admin` permission and Streamer Mode enabled executes `/voice admin` while the voice backend is connected
- **THEN** the plugin SHALL register the administrative token with `streamerMode: true` and send a masked chat prompt offering `[Open Panel]` (clean `/admin` URL), `[Copy Code]`, and `[Copy Link]` clipboard actions without printing the token or tokenized URL in chat.

#### Scenario: Non-admin player attempts access
- **WHEN** a player without the `voiceengine.admin` permission executes `/voice admin`
- **THEN** the plugin SHALL reject the command with a permission denied error message.

#### Scenario: Backend disconnected during admin command
- **WHEN** a player with the `voiceengine.admin` permission executes `/voice admin` while the voice backend WebSocket is disconnected or closed
- **THEN** the plugin SHALL inform the player that the VoiceEngine backend is offline and abort token dispatch.

## ADDED Requirements

### Requirement: Persistent In-Game Streamer Mode Preference and Bidirectional Sync
The plugin SHALL provide a `/voice streamer [on|off|status]` command persisted per player UUID in `player-preferences.yml` and synchronized bidirectionally with the voice backend.

#### Scenario: Player toggles Streamer Mode in game
- **WHEN** a player with `voiceengine.streamer` executes `/voice streamer` or `/voice streamer <on|off>`
- **THEN** the plugin SHALL persist the updated preference for that player's UUID in `player-preferences.yml`, confirm the new state in chat, and transmit a `streamer_mode_sync` frame to the voice backend if connected.

#### Scenario: Player inspects Streamer Mode status
- **WHEN** a player executes `/voice streamer status`
- **THEN** the plugin SHALL report whether Streamer Mode is currently enabled or disabled for their UUID without exposing sensitive data.

#### Scenario: Join welcome notification reflects active Streamer Mode
- **WHEN** a player with Streamer Mode enabled joins a standalone Paper server with `notify-on-join` enabled
- **THEN** the plugin SHALL deliver a join notification indicating that Streamer Mode is active before they execute `/voice`.

#### Scenario: Backend pushes Streamer Mode update from web client
- **WHEN** the plugin receives a `streamer_mode_sync` frame from the voice backend for a player UUID
- **THEN** the plugin SHALL persist the updated `streamerMode` boolean to `player-preferences.yml` so subsequent `/voice` commands and joins reflect the web client change.
