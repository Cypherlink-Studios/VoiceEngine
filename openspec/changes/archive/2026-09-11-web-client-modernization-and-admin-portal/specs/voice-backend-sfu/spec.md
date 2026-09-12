## ADDED Requirements

### Requirement: Fixed Channel Stereo Audio Routing
The backend SFU SHALL route audio for players inside the same fixed channel in stereo without positional attenuation or spatial culling.

#### Scenario: Routing audio within a fixed channel
- **WHEN** two or more connected players are joined to the same fixed channel
- **THEN** the SFU SHALL create audio consumers forwarding speech between them at full gain regardless of distance, dimension, or player coordinates.

### Requirement: Server Settings Persistence and Public Configuration API
The backend SHALL maintain a persistent `data/settings.json` file and expose a public endpoint `GET /api/config/public` returning brand settings and active fixed channels.

#### Scenario: Public configuration retrieval
- **WHEN** a client sends a GET request to `/api/config/public`
- **THEN** the backend SHALL return current branding information, slot limits, and available public fixed channels.

### Requirement: Administrative Authentication and Protected API
The backend SHALL validate administrative session tokens and expose protected endpoints for updating settings and reading metrics.

#### Scenario: Admin token redemption
- **WHEN** a client submits a valid admin token to `/api/admin/auth`
- **THEN** the backend SHALL issue an administrative session token and authorize access to `/api/admin/settings`.
