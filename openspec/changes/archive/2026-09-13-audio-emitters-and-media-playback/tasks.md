## 1. Voice Server Media Infrastructure & Range Streaming

- [x] 1.1 Configure shared media directory path (`plugins/VoiceEngine/media/` and `media/cache/`) in `voice-server/src/config.ts` and verify folder initialization on boot
- [x] 1.2 Implement Express static streaming route `GET /api/media/*` supporting `Range` headers with `HTTP 206 Partial Content` and verify chunked audio streaming via curl/tests
- [x] 1.3 Add CORS proxy streaming endpoint `GET /api/media/proxy` for remote internet streams and verify cross-origin headers are returned


## 2. Media Downloader & Cache Service

- [x] 2.1 Implement `MediaCacheService` in `voice-server` to download and cache external audio streams (YouTube/SoundCloud/direct URLs) to `media/cache/<hash>.mp3` and verify extraction
- [x] 2.2 Implement cache quota tracking, maximum age eviction, and manual purge method in `MediaCacheService` and verify unit tests pass
- [x] 2.3 Add API/IPC routes for cache status inspection and cache purging


## 3. Server Clock Synchronization & Audio Emitter State Engine

- [x] 3.1 Implement lightweight WebSocket NTP time sync in `ClientGateway` (`time_sync` ping/pong) and verify sub-millisecond round-trip calculation
- [x] 3.2 Implement `AudioEmitterManager` in `voice-server` tracking active emitters (`id`, `source`, `position`, `radius`, `startedAt`, `duration`, `loop`, `volume`, `state`) and verify emitter lifecycle unit tests
- [x] 3.3 Broadcast `audio_state` batches and delta `audio_event` updates to connected web clients and handle plugin IPC audio control frames


## 4. Paper Plugin Audio Commands & Persistence

- [x] 4.1 Implement `AudioManager` in Paper plugin to maintain active emitters and manage `plugins/VoiceEngine/audio.yml` persistence
- [x] 4.2 Register `/voice audio` command hierarchy (`play`, `broadcast`, `sfx`, `stop`, `pause`, `resume`, `volume`, `list`, `files`, `cache`, `particles`) with tab-completion and permissions
- [x] 4.3 Implement particle feedback scheduler spawning `Particle.NOTE` at active spatial emitter locations with toggleable suppression
- [x] 4.4 Implement file discovery listing local `.mp3`, `.ogg`, and `.wav` tracks in `plugins/VoiceEngine/media/`

## 5. Speaker Block Media Source Binding

- [x] 5.1 Extend `SpeakerBlock` model and `SpeakerManager` in Paper plugin to support binding an audio media source
- [x] 5.2 Implement `/voice speaker play <id> <source> [--loop]` and `/voice speaker stop <id>` commands
- [x] 5.3 Enforce redstone power gating to pause or mute bound media playback on redstone-gated speaker blocks

## 6. Web Client Synchronized Media Pipeline

- [x] 6.1 Create `MediaPipeline` in `web-client` integrated into `SpatialAudioPipeline` with dedicated `mediaBusGain` routing
- [x] 6.2 Implement NTP clock offset synchronization and absolute track position seeking (`(now + clockOffset - startedAt) % duration`) on stream entry
- [x] 6.3 Implement 3D spatial emitter playback with linear distance attenuation (`PannerNode.distanceModel = 'linear'`) and out-of-range node suspension
- [x] 6.4 Add "Media & Music Volume" slider and "Mute Media" quick toggle in `SettingsModal.tsx` isolated from player voice volume

## 7. End-to-End Verification & Testing

- [x] 7.1 Run voice-server test suite including MediaCacheService, AudioEmitterManager, and Range streaming tests
- [x] 7.2 Run Paper plugin Gradle tests verifying command execution, speaker block media binding, and audio.yml persistence
- [x] 7.3 Run web-client test suite and build verification for MediaPipeline and volume UI controls
