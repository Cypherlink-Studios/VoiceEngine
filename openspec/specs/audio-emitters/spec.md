# audio-emitters Specification

## Purpose

Provides an in-game audio emitter system for playing synchronized spatial 3D audio, global broadcasts, and one-shot sound effects from local files and cached web streams.

## Requirements

### Requirement: Audio Emitter Creation and Playback Management
The Paper plugin and voice backend SHALL provide administrative commands under `/voice audio` to create, locate, and broadcast audio streams identified by unique emitter IDs.

#### Scenario: Staff initiates spatial 3D audio playback at specific coordinates
- **WHEN** an administrator executes `/voice audio play <id> <source> <x> <y> <z> [radius] [--loop]`
- **THEN** the plugin SHALL validate coordinates, resolve the source, register the emitter with its spatial radius (defaulting to 30 blocks if omitted), and transmit an `audio_emitter_start` frame over WebSocket to the voice server.

#### Scenario: Staff initiates global 2D audio broadcast
- **WHEN** an administrator executes `/voice audio broadcast <id> <source> [--loop]`
- **THEN** the system SHALL register the emitter with spatial mode disabled and dispatch playback instructions to all connected web clients.

#### Scenario: Staff triggers one-shot sound effect
- **WHEN** an administrator executes `/voice audio sfx <source> [<x> <y> <z>] [radius]`
- **THEN** the system SHALL create an ephemeral emitter that plays once and automatically cleans itself up from memory upon track completion.

### Requirement: Audio Emitter Lifecycle Control by ID
The system SHALL support pausing, resuming, stopping, and adjusting volume for active audio emitters using their unique identifier.

#### Scenario: Staff pauses an active emitter
- **WHEN** an administrator executes `/voice audio pause <id>`
- **THEN** the system SHALL transition the emitter's state to `PAUSED`, record the pause timestamp, and instruct web clients to pause playback at the current track position.

#### Scenario: Staff resumes a paused emitter
- **WHEN** an administrator executes `/voice audio resume <id>`
- **THEN** the system SHALL transition the emitter's state to `PLAYING`, recalculate the start timestamp offset, and instruct web clients to resume playback.

#### Scenario: Staff stops single or all emitters
- **WHEN** an administrator executes `/voice audio stop <id>` or `/voice audio stop all`
- **THEN** the system SHALL immediately terminate playback, remove the emitter(s) from memory and active telemetry, and instruct web clients to destroy the associated media nodes.

#### Scenario: Staff adjusts master volume of an emitter
- **WHEN** an administrator executes `/voice audio volume <id> <level>` with a level between 0.0 and 1.0
- **THEN** the system SHALL update the emitter's gain multiplier and synchronize the new volume with listening web clients in real time.

#### Scenario: Staff inspects active audio emitters
- **WHEN** an administrator executes `/voice audio list`
- **THEN** the plugin SHALL render a formatted table showing all active emitters, their IDs, source paths, state (PLAYING/PAUSED), mode (Spatial/Global), coordinates, and elapsed track time.

### Requirement: Shared Media Directory and Local File Streaming
The voice backend and Paper plugin SHALL operate on a shared `plugins/VoiceEngine/media/` directory containing audio files, serving them to web clients with HTTP 206 Partial Content range requests.

#### Scenario: Staff lists available local audio files
- **WHEN** an administrator executes `/voice audio files`
- **THEN** the plugin SHALL list all valid `.mp3`, `.ogg`, and `.wav` files present in `plugins/VoiceEngine/media/` with their file sizes.

#### Scenario: Web client requests media stream with range header
- **WHEN** a web client requests `GET /api/media/:file` with an HTTP `Range` request header
- **THEN** the voice server SHALL respond with HTTP status `206 Partial Content` and the requested byte chunk, enabling instant playback seeking.

### Requirement: Remote Media and YouTube/SoundCloud Cache Management
The voice backend SHALL extract audio from internet streams and platforms into a local cache directory (`media/cache/`), providing configurable storage limits and administrative purge controls.

#### Scenario: Remote media download and caching
- **WHEN** an administrator triggers playback with a YouTube, SoundCloud, or external URL
- **THEN** the voice server SHALL download the extracted audio in the background to `media/cache/<hash>.mp3`, emit status feedback to the admin in chat, and start synchronized playback once cached.

#### Scenario: Staff inspects cache status
- **WHEN** an administrator executes `/voice audio cache status`
- **THEN** the plugin SHALL display total cached files, total disk space consumed, configured cache size limit, and the oldest cached file.

#### Scenario: Staff purges cached audio files
- **WHEN** an administrator executes `/voice audio cache purge <duration>` (e.g. `7d`, `24h`, or `all`)
- **THEN** the system SHALL delete cached audio files not accessed within the specified duration and display the reclaimed disk space.

### Requirement: Audio Emitter Persistence
The Paper plugin SHALL optionally persist active audio emitters in `plugins/VoiceEngine/audio.yml` when configured in `config.yml`.

#### Scenario: Server restart restores persisted emitters
- **WHEN** the server restarts or executes `/voice reload` while `audio.persistence: true`
- **THEN** the plugin SHALL read `audio.yml`, recreate all persistent emitters, and re-establish synchronized playback through the voice backend.

### Requirement: In-Game Particle Feedback and Lag Suppression
The Paper plugin SHALL spawn visual note particles at active spatial emitter locations, providing configuration toggles to disable particle rendering for server performance.

#### Scenario: Particles spawn during active spatial playback
- **WHEN** an emitter in spatial mode is actively playing and `audio.particles: true`
- **THEN** the plugin SHALL periodically spawn musical note particles (`Particle.NOTE`) at the emitter's coordinates.

#### Scenario: Particle suppression when toggled or disabled
- **WHEN** an administrator executes `/voice audio particles off` or configures `audio.particles: false`
- **THEN** the plugin SHALL suppress particle spawning across all emitters.
