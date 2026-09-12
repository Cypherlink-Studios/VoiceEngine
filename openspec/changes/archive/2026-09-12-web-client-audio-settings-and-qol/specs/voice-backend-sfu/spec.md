## ADDED Requirements

### Requirement: WebSocket Client Latency Probe Protocol
The voice server client gateway SHALL handle client ping messages and immediately respond with pong frames carrying the client's original timestamp.

#### Scenario: Client ping dispatch and immediate server pong response
- **WHEN** a connected web client sends a `{ type: 'ping', timestamp: number }` WebSocket frame
- **THEN** the client gateway SHALL immediately respond with `{ type: 'pong', timestamp: number }` echoing the received timestamp.
