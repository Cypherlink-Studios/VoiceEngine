# velocity-voice-proxy Specification

## Purpose
Provides centralized network-level voice chat orchestration for Velocity proxies, handling global commands, session token dispatch, and cross-server player tracking.

## ADDED Requirements

### Requirement: Centralized Proxy Voice Command Dispatch
The Velocity plugin SHALL register a network-wide /voice command hierarchy accessible from any connected backend server.

#### Scenario: Player executes voice command on any backend server
- **WHEN** a player executes /voice on any server within the proxy network
- **THEN** the Velocity plugin SHALL intercept the command, generate a connection token, and send a clickable web client link and code in chat.

#### Scenario: Administrator executes reload on proxy
- **WHEN** a player with administrative permission executes /voice reload on the proxy
- **THEN** the Velocity plugin SHALL reload its configuration, reconnect to the voice backend if credentials changed, and confirm status in chat.

#### Scenario: Administrator requests admin portal link
- **WHEN** a player with oiceengine.admin executes /voice admin on the proxy
- **THEN** the Velocity plugin SHALL generate an administrative token, register it with the voice server, and send a clickable URL targeting the admin portal.

### Requirement: Network Session Token Management and Backend Synchronization
The Velocity plugin SHALL generate secure short-lived session tokens and synchronize them with the voice backend via WebSocket.

#### Scenario: Dispatching token registration frame
- **WHEN** a session token is generated for an online player
- **THEN** the plugin SHALL transmit a egister_token frame over WebSocket to the voice server before returning the code to the player.

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
