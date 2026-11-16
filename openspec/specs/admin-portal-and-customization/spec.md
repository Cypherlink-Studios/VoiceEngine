# admin-portal-and-customization Specification

## Purpose
Provides a web-based administrative management portal, dynamic visual branding customization, persistent runtime settings, and fixed audio channel orchestration for VoiceEngine.

## Requirements

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

### Requirement: Dynamic Visual Branding Customizer
The system SHALL allow administrators to customize visual brand attributes with real-time live preview and persist the configuration.

#### Scenario: Visual brand configuration update
- **WHEN** an administrator modifies primary colors, accent colors, server name, logo URL, background wallpaper, or welcome message and saves
- **THEN** the system SHALL persist the settings to `data/settings.json` and make the updated branding available via `GET /api/config/public`.

### Requirement: Fixed Channel Voice Rooms Management
The system SHALL allow administrators to create, update, and remove fixed Discord-style voice channels with configurable network scope (global or server-isolated).

#### Scenario: Fixed channel creation
- **WHEN** an administrator creates a new fixed channel with a name, description, user limit, and selected scope (global or server-isolated)
- **THEN** the system SHALL register the channel in persistent settings with the specified scope (defaulting to global) and broadcast the channel list to all connected clients.

### Requirement: Runtime Backend Tuning and Health Monitoring
The system SHALL allow administrators to adjust server slot limits, audio bitrates, and proximity distance thresholds at runtime and monitor connected sessions.

#### Scenario: Adjusting voice distance thresholds
- **WHEN** an administrator updates the maximum voice distance or sneak distance in the admin portal
- **THEN** the backend spatial engine SHALL immediately apply the new thresholds to proximity calculations without restarting the service.

### Requirement: Development Environment API Routing and Test Admin Token
The development environment SHALL route administrative REST API calls to the backend and provide a reusable development administrator token.

#### Scenario: Development API proxying
- **WHEN** the web client development server receives requests targeting `/api`
- **THEN** the dev server SHALL proxy the requests to the voice server backend at port 3000.

#### Scenario: Development admin token redemption
- **WHEN** a developer attempts to authenticate in `/admin` using the built-in development admin token `ADMIN1`
- **THEN** the server SHALL authenticate the session and allow repeated redemption across local test runs.
