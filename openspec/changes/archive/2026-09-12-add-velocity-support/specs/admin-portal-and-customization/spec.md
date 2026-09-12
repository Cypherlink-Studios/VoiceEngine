# admin-portal-and-customization Specification Delta

## MODIFIED Requirements

### Requirement: Fixed Channel Voice Rooms Management
The system SHALL allow administrators to create, update, and remove fixed Discord-style voice channels with configurable network scope (global or server-isolated).

#### Scenario: Fixed channel creation
- **WHEN** an administrator creates a new fixed channel with a name, description, user limit, and selected scope (global or server-isolated)
- **THEN** the system SHALL register the channel in persistent settings with the specified scope (defaulting to global) and broadcast the channel list to all connected clients.
