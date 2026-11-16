# admin-portal-and-customization Spec Delta

## MODIFIED Requirements

### Requirement: Administrative Portal Access and Session Authentication
The portal SHALL enforce token-based administrative authentication issued via in-game authorization and provide protected administrative sessions with resilient token exchange, immediate URL token sanitization, Streamer Mode masking, and local development proxying.

#### Scenario: Admin token verification
- **WHEN** an admin visits `/admin` with a valid administrative token
- **THEN** the system SHALL validate the token, issue a secure administrative session (including the token's `streamerMode` flag if present), and unlock the management dashboard.

#### Scenario: Unauthorized or missing token access
- **WHEN** an unauthenticated user visits `/admin` without a valid token
- **THEN** the portal SHALL display an access-restricted screen instructing them to run `/voice admin` in Minecraft.

#### Scenario: Single-use token exchange concurrency resilience
- **WHEN** the administrative portal component mounts or updates in development environments with a token URL parameter
- **THEN** the client SHALL immediately strip the `token` search parameter from the browser address bar via `window.history.replaceState` before/while exchanging the token and guard against duplicate concurrent authentication requests.

#### Scenario: Masked manual admin code input
- **WHEN** an administrator pastes or types an admin code into the `/admin` manual verification form while Streamer Mode is enabled (or masking is active)
- **THEN** the input field SHALL render characters masked (`type="password"`) with an explicit eye toggle to show or hide the code.
