## ADDED Requirements

### Requirement: Spectator Voice Routing and Proximity Isolation
The voice backend SHALL evaluate spectator status in telemetry updates and enforce configured spectator routing policies to prevent spectators from transmitting audio to living players.

#### Scenario: Unidirectional proximity in listen-only spectator mode
- **WHEN** a player tagged as a spectator is in proximity to living players under `listen-only` mode
- **THEN** the spatial engine SHALL route audio from living speakers to the spectator listener while excluding the spectator's audio from living listeners' audible streams.

#### Scenario: Complete proximity isolation in isolated spectator mode
- **WHEN** a player tagged as a spectator is in proximity to living players under `isolated` mode
- **THEN** the spatial engine SHALL isolate audio between spectators and living players so neither group receives audio from the other.

#### Scenario: Standard proximity in unrestricted spectator mode
- **WHEN** spectator mode is configured as `all`
- **THEN** the spatial engine SHALL evaluate proximity between spectators and living players without role-based culling.
