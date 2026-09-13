# speaker-blocks Specification

## Purpose
Allows server administrators and event organizers to designate in-game blocks as virtual public address sound emitters that broadcast an authorized player's voice across a configurable area using uniform 2D acoustics.

## Requirements

### Requirement: Speaker Block Creation and Lifecycle Management
The Paper plugin SHALL provide administrative commands under `/voice speaker` allowing authorized staff to register, inspect, and remove speaker blocks in the Minecraft world.

#### Scenario: Staff creates a speaker block from targeted block
- **WHEN** a player with `voiceengine.admin.speaker` targets a solid block within 5 blocks and executes `/voice speaker create <id> [radius]`
- **THEN** the plugin SHALL register the block's coordinates, world, and broadcast radius (defaulting to 30 blocks if omitted) and save it to the speaker registry.

#### Scenario: Staff removes an existing speaker block
- **WHEN** an administrator executes `/voice speaker remove <id>`
- **THEN** the plugin SHALL remove the speaker block from the registry and immediately notify the voice backend to stop routing audio for that speaker ID.

#### Scenario: Staff lists registered speaker blocks
- **WHEN** an administrator executes `/voice speaker list`
- **THEN** the plugin SHALL display all registered speaker blocks with their ID, coordinates, world, radius, linked player, and active status.

### Requirement: Speaker Block Player Voice Linking
The Paper plugin SHALL allow associating a specific online player's voice output with a registered speaker block.

#### Scenario: Linking player voice to speaker block
- **WHEN** an administrator executes `/voice speaker link <id> <player>` for an online player
- **THEN** the plugin SHALL bind the player's UUID to the speaker block and update the active telemetry sent to the voice backend.

#### Scenario: Unlinking player from speaker block
- **WHEN** an administrator executes `/voice speaker unlink <id>`
- **THEN** the plugin SHALL clear the linked player UUID and stop broadcasting through the speaker block.

### Requirement: Redstone Power Activation Toggle
The Paper plugin SHALL support optional redstone gating for speaker blocks.

#### Scenario: Speaker block requires redstone power
- **WHEN** a speaker block is configured with redstone gating enabled (`/voice speaker redstone <id> true`)
- **THEN** the speaker block SHALL broadcast audio ONLY when receiving indirect or direct redstone power from neighboring blocks.

#### Scenario: Always-on speaker block without redstone
- **WHEN** a speaker block is configured with redstone gating disabled (`/voice speaker redstone <id> false`)
- **THEN** the speaker block SHALL remain continuously active regardless of redstone power.

### Requirement: In-Game Visual Particle Feedback at Speaker Block
The Paper plugin SHALL spawn visual note particles at the speaker block coordinates whenever the linked player is actively speaking.

#### Scenario: Active broadcast particle emission
- **WHEN** the linked player speaks while their associated speaker block is active and in the same world
- **THEN** the plugin SHALL spawn musical note particles (`Particle.NOTE`) around the top of the speaker block.

#### Scenario: Inactive or silent particle suppression
- **WHEN** the linked player stops speaking or the speaker block is deactivated by redstone
- **THEN** the plugin SHALL cease spawning particles at the block.

### Requirement: Speaker Block Persistence
The Paper plugin SHALL persist all configured speaker blocks in a dedicated configuration file (`plugins/VoiceEngine/speakers.yml`).

#### Scenario: Server restart loads speaker configuration
- **WHEN** the Paper server starts or executes `/voice reload`
- **THEN** the plugin SHALL load all saved speaker blocks from `speakers.yml` into memory and validate block coordinates.

### Requirement: Speaker Block Media Audio Source Binding
The Paper plugin and voice backend SHALL allow binding audio files or web streams directly to registered speaker blocks, inheriting the block's physical coordinates, radius, and redstone power controls.

#### Scenario: Staff binds media track to speaker block
- **WHEN** an administrator executes `/voice speaker play <id> <source> [--loop]`
- **THEN** the plugin SHALL attach the audio source to the speaker block, configure it as an active emitter rooted at the block's coordinates, and notify the voice backend to stream the audio within the block's coverage radius.

#### Scenario: Redstone power gating pauses or mutes speaker media
- **WHEN** a speaker block configured with redstone gating loses redstone power while playing a media track
- **THEN** the system SHALL immediately mute or pause the media audio output for nearby listeners until redstone power is restored.

#### Scenario: Staff stops speaker block media playback
- **WHEN** an administrator executes `/voice speaker stop <id>`
- **THEN** the plugin SHALL clear the active media emitter from the speaker block and stop audio routing for that block.
