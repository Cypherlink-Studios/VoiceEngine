## MODIFIED Requirements

### Requirement: Administrative Portal Access and Session Authentication
The portal SHALL enforce token-based administrative authentication issued via in-game authorization and provide protected administrative sessions with resilient token exchange and local development proxying.

#### Scenario: Admin token verification
- **WHEN** an admin visits `/admin` with a valid administrative token
- **THEN** the system SHALL validate the token, issue a secure administrative session, and unlock the management dashboard.

#### Scenario: Unauthorized or missing token access
- **WHEN** an unauthenticated user visits `/admin` without a valid token
- **THEN** the portal SHALL display an access-restricted screen instructing them to run `/voice admin` in Minecraft.

#### Scenario: Single-use token exchange concurrency resilience
- **WHEN** the administrative portal component mounts or updates in development environments with a token URL parameter
- **THEN** the client SHALL guard against duplicate concurrent authentication requests and sanitize the token search parameter from the URL upon successful exchange.

## ADDED Requirements

### Requirement: Development Environment API Routing and Test Admin Token
The development environment SHALL route administrative REST API calls to the backend and provide a reusable development administrator token.

#### Scenario: Development API proxying
- **WHEN** the web client development server receives requests targeting `/api`
- **THEN** the dev server SHALL proxy the requests to the voice server backend at port 3000.

#### Scenario: Development admin token redemption
- **WHEN** a developer attempts to authenticate in `/admin` using the built-in development admin token `ADMIN1`
- **THEN** the server SHALL authenticate the session and allow repeated redemption across local test runs.
