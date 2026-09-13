## Why

Server administrators, builders, and event organizers need the ability to play custom background music, ambient soundscapes, and synchronized sound effects in Minecraft without requiring client-side resource pack downloads or external mods. Providing a high-fidelity, synchronized audio emitter system for local files, direct web streams, and cached internet audio creates rich, immersive in-game atmospheres while maintaining client performance and clock alignment across listeners.

## What Changes

- **Audio Emitter Management & In-Game Commands**: Introduce a full command suite under `/voice audio` (`play`, `stop`, `pause`, `resume`, `volume`, `list`, `files`, `sfx`, `cache`, `particles`) allowing staff to manage spatial 3D emitters and 2D global broadcasts identified by unique IDs.
- **Shared Storage & Local Playback**: Configure a shared `plugins/VoiceEngine/media/` directory housing `.mp3`, `.ogg`, and `.wav` tracks, accessible directly by both the Paper plugin and the voice backend.
- **On-Demand Web & YouTube/SoundCloud Extraction**: Provide a background cache manager that resolves external streams or downloads media to `media/cache/`, with configurable size/age limits and admin purge commands.
- **Clock Synchronization & Phase-Locked Seeking**: Implement lightweight WebSocket NTP time synchronization and absolute timestamp offset math (`(now - startedAt) % duration`) so players entering audible zones immediately hear the track at the exact same beat.
- **Linear 3D Spatial Attenuation**: Route 3D emitters through Web Audio API `PannerNode` with a linear distance attenuation model, suspending nodes when out of audible radius to conserve browser resources.
- **Speaker Block Media Integration**: Expand existing Speaker Blocks to accept audio tracks or web streams as sound sources in addition to live player voice.
- **Player Local Media Gain Isolation**: Add independent "Music & Effects" volume controls and mute toggles in the web client, strictly isolating player-side volume preferences without affecting server playback state.

## Capabilities

### New Capabilities
- `audio-emitters`: In-game management, playback orchestration, caching, persistence, and time synchronization for spatial 3D and 2D global audio emitters.

### Modified Capabilities
- `speaker-blocks`: Extends speaker block definitions to support binding audio files and internet streams alongside live player voice links.
- `web-client-spatial-audio`: Integrates synchronized HTML5/Web Audio media playback nodes with linear distance attenuation and an isolated client-side media volume slider.

## Impact

- **Paper Plugin**: Adds `/voice audio` command tree, `AudioManager`, `audio.yml` persistence, particle emission loop, and shared media directory resolution.
- **Voice Server (`voice-server`)**: Adds `MediaService` with HTTP 206 Partial Content range streaming, background media cache extraction, clock synchronization WebSocket handlers, and emitter state distribution.
- **Web Client (`web-client`)**: Extends `SpatialAudioPipeline` with dedicated `mediaBusGain`, `MediaPipeline` synchronizer, and settings UI controls for media volume.
- **Dependencies**: Adds lightweight audio extraction utilities (e.g., `yt-dlp` integration or `@distube/ytdl-core`) on the voice server.
