# velocity-voice-proxy Specification

## Purpose
Provides centralized network-level voice chat orchestration for Velocity proxies, handling global commands, session token dispatch, and cross-server player tracking.

## Requirements

### Requirement: Centralized Proxy Voice Command Dispatch
The Velocity plugin SHALL register a network-wide command hierarchy with `/voice`, `/ve`, `/voiceengine`, and `/audio` aliases accessible from any connected backend server.

#### Scenario: Player executes voice command on any backend server
- **WHEN** a player executes `/voice`, `/ve`, `/voiceengine`, or `/audio` on any server within the proxy network
- **THEN** the Velocity plugin SHALL intercept the command, generate a connection token, and send a clickable web client link and code in chat.

#### Scenario: Administrator executes reload on proxy
- **WHEN** a player or console with administrative permission executes `/voice reload`, `/ve reload`, `/voiceengine reload`, or `/audio reload` on the proxy
- **THEN** the Velocity plugin SHALL reload its configuration file, re-establish the WebSocket connection if the backend URI or secret key changed, update active token TTL for subsequent tokens, and confirm status in chat.

#### Scenario: Administrator requests admin portal link
- **WHEN** a player with `voiceengine.admin` executes `/voice admin`, `/ve admin`, `/voiceengine admin`, or `/audio admin` on the proxy
- **THEN** the Velocity plugin SHALL generate an administrative token, register it with the voice server, and send a clickable URL targeting the admin portal.

#### Scenario: Administrator inspects proxy status
- **WHEN** a player with `voiceengine.admin.status` executes `/voice status`, `/ve status`, `/voiceengine status`, or `/audio status` on the proxy
- **THEN** the Velocity plugin SHALL display the configured voice server URI, connection state, and reconnect attempt count.

### Requirement: Network Session Token Management and Backend Synchronization
The Velocity plugin SHALL generate secure short-lived session tokens, bind them to the player's remote network IP, and synchronize them with the voice backend via WebSocket.

#### Scenario: Dispatching token registration frame
- **WHEN** a session token is generated for an online player
- **THEN** the plugin SHALL capture the player's remote network IP address and transmit a `register_token` frame over WebSocket to the voice server containing token, player UUID, player name, expiration timestamp, admin flag, and the player's remote IP address (`clientIp`) before returning the code to the player.

#### Scenario: Backend WebSocket reconnection on proxy
- **WHEN** the proxy loses its WebSocket connection to the voice server
- **THEN** the plugin SHALL schedule automatic reconnection attempts with exponential backoff while queuing or failing pending token requests gracefully.

### Requirement: Network Lifecycle Notifications and Server Transition Tracking
The Velocity plugin SHALL notify players upon joining the network and track server transitions across backend servers.

#### Scenario: First join network welcome notification
- **WHEN** a player connects to the Velocity proxy and establishes their initial server connection
- **THEN** the plugin SHALL deliver the voice chat welcome notification once, without repeating on subsequent server switches.

#### Scenario: Server switch tracking
- **WHEN** a player transitions from one backend server to another (e.g. from Lobby to Survival)
- **THEN** the Velocity plugin SHALL detect the server connection event and notify the voice server of the player's updated backend server identifier.

### Requirement: Proxy Player Presence Binding on Disconnect
The Velocity plugin SHALL immediately notify the voice backend when a player leaves the proxy network to terminate any orphaned web client sessions.

#### Scenario: Player disconnects from proxy network
- **WHEN** a player disconnects from the Velocity proxy (`DisconnectEvent`)
- **THEN** the plugin SHALL transmit a `player_quit` frame over WebSocket to the voice server with the player's UUID, instructing the backend to immediately terminate their web client session.

