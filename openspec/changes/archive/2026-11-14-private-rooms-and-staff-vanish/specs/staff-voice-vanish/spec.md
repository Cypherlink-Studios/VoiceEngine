# Spec Delta

## Purpose

Enforces zero-leak stealth for server staff during proximity monitoring, preventing any acoustic, network, or visual detection by regular players while maintaining staff-to-staff awareness.

## ADDED Requirements

### Requirement: Zero-Leak WebRTC Consumer and Spatial Coordinate Suppression
The system SHALL guarantee that regular players' WebRTC receive transports never create consumers for vanished staff audio tracks, and that spatial evaluation routines omit vanished staff coordinates from proximity batches.

#### Scenario: Regular player receives no WebRTC consumer for vanished staff
- **WHEN** a staff member in vanish mode approaches a regular player within proximity range
- **THEN** the SFU creates no WebRTC consumer on the player's connection, transmits no coordinates in proximity batches, and renders no icon on the web radar.

#### Scenario: Vanished staff hears nearby regular players
- **WHEN** a staff member in vanish mode is within proximity range of regular players
- **THEN** the staff member receives 3D spatialized audio and radar updates for those players without transmitting audio back.

### Requirement: Staff Vanish State Activation and Persistence
The system SHALL provide administrative commands (`/voice vanish` and `/voice staff`) to toggle acoustic vanish mode for players with `voiceengine.admin.vanish`, persisting active status on the voice server across client reloads and reconnections.

#### Scenario: Toggle vanish mode in-game
- **WHEN** an authorized player executes `/voice vanish`
- **THEN** their vanish state toggles, the voice server updates routing rules immediately, and an actionbar confirmation is displayed.

#### Scenario: Stealth preserved across web client reload
- **WHEN** a staff member with active vanish mode refreshes their web client
- **THEN** the voice server retains their vanish status during token redemption and suppresses consumer creation towards regular players from initial handshake.

### Requirement: Mutual Staff-to-Staff Acoustic and Radar Visibility
The system SHALL route 3D spatialized proximity audio and radar indicators between vanished staff members, allowing mutual communication while remaining concealed from regular players.

#### Scenario: Vanished staff communicate with each other
- **WHEN** two vanished staff members are within proximity range of each other
- **THEN** both receive mutual 3D spatial audio streams and see each other's heads on the web radar.

#### Scenario: Non-staff nearby hears neither staff member
- **WHEN** a regular player stands between two vanished staff members who are speaking
- **THEN** the regular player hears silence and sees neither staff member on the radar or in-game.

### Requirement: In-Game Visual Particle and Glow Suppression
The Paper plugin SHALL suppress speech feedback particle emission and glowing visual indicators above vanished staff members, preventing visual detection of speech activity in the Minecraft world.

#### Scenario: Speaking in vanish produces no in-game particles
- **WHEN** a vanished staff member speaks into their microphone
- **THEN** the visual feedback system emits no musical note or sound wave particles at their Minecraft player coordinates.

### Requirement: Automatic Integration with Server Vanish Plugins
The Paper plugin SHALL support optional configuration to automatically synchronize voice vanish state with supported Minecraft vanish plugins or player visibility events.

#### Scenario: Minecraft vanish command triggers voice vanish
- **WHEN** a staff member enters vanish via a supported plugin (EssentialsX, SuperVanish, PremiumVanish) and auto-sync is enabled
- **THEN** the plugin automatically activates voice vanish mode and notifies the voice backend.
