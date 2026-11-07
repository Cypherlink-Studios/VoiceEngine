# Spec Delta

## MODIFIED Requirements

### Requirement: Authentication Token Generation and Dispatch
The plugin SHALL provide a `/voice` command and automatic welcome notification that generates cryptographically secure, short-lived one-time tokens and provides a clickable URL in chat for web client onboarding.

#### Scenario: Player requests voice connection link
- **WHEN** an online player executes `/voice` in game
- **THEN** the plugin SHALL generate a one-time connection token associated with the player's UUID and send a clickable chat message linking directly to the web client with the token.

#### Scenario: Expired token rejection
- **WHEN** a player attempts to redeem a connection token after its configured time-to-live has elapsed
- **THEN** the system SHALL reject the authentication attempt and prompt the player to generate a new token via `/voice`.

#### Scenario: Token registration incorporates originating server identifier
- **WHEN** a player generates a session token via `/voice` or `/voice admin`
- **THEN** the plugin SHALL dispatch a `register_token` frame over WebSocket to the voice server containing `token`, `playerUuid`, `playerName`, `expiresAt`, `isAdmin`, and the configured `serverId`.
