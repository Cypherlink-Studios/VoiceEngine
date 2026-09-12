# velocity-voice-proxy Specification Delta

## MODIFIED Requirements

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
