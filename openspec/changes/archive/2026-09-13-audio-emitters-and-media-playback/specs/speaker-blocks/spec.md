## ADDED Requirements

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
