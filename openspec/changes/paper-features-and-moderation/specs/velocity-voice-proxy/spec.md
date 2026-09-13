## MODIFIED Requirements

### Requirement: Network Session Token Management and Backend Synchronization
The Velocity plugin SHALL generate secure short-lived session tokens, bind them to the player's remote network IP, and synchronize them with the voice backend via WebSocket.

#### Scenario: Dispatching token registration frame
- **WHEN** a session token is generated for an online player
- **THEN** the plugin SHALL capture the player's remote network IP address and transmit a `register_token` frame over WebSocket to the voice server containing token, player UUID, player name, expiration timestamp, admin flag, and the player's remote IP address (`clientIp`) before returning the code to the player.

#### Scenario: Backend WebSocket reconnection on proxy
- **WHEN** the proxy loses its WebSocket connection to the voice server
- **THEN** the plugin SHALL schedule automatic reconnection attempts with exponential backoff while queuing or failing pending token requests gracefully.

## ADDED Requirements

### Requirement: Proxy Player Presence Binding on Disconnect
The Velocity plugin SHALL immediately notify the voice backend when a player leaves the proxy network to terminate any orphaned web client sessions.

#### Scenario: Player disconnects from proxy network
- **WHEN** a player disconnects from the Velocity proxy (`DisconnectEvent`)
- **THEN** the plugin SHALL transmit a `player_quit` frame over WebSocket to the voice server with the player's UUID, instructing the backend to immediately terminate their web client session.
