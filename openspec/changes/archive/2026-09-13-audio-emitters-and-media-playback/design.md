## Context

VoiceEngine manages real-time proximity voice chat using a Mediasoup SFU, a Paper plugin for player coordinate telemetry, and a Next.js web client using the Web Audio API. See `proposal.md` for motivation.

To deliver background music, ambient soundscapes, and event sound effects without placing heavy transcode loads on the SFU server, this design adopts a synchronized client-side media pipeline orchestrated by the server, utilizing HTTP Range streaming, NTP clock synchronization, and local disk caching.

## Goals / Non-Goals

**Goals:**
- Provide low-overhead, high-fidelity stereo audio playback from server files (`plugins/VoiceEngine/media/`), direct internet URLs, and cached YouTube/SoundCloud links.
- Maintain sub-50ms synchronization across all listeners in an audible zone using server-anchored timestamps and client clock offset math.
- Expose a full in-game command hierarchy under `/voice audio` with emitter IDs, position targeting, volume controls, file listing, and cache management.
- Allow speaker blocks to bind to media emitters with redstone power gating.
- Render 3D spatial emitters using linear distance attenuation while suspending nodes when listeners are out of range.
- Provide isolated client-side "Media & Music Volume" controls that never interfere with player voice volumes or server state.

**Non-Goals:**
- Real-time server-side FFmpeg transcoding into WebRTC RTP packets (rejected to conserve CPU and preserve uncompressed stereo audio).
- In-game file uploading through Minecraft chat (files are uploaded to `plugins/VoiceEngine/media/` via SFTP/FTP/file manager, or downloaded from URLs).
- Client-side modification of server-wide playback by non-admin players.

## Decisions

### 1. Client-Side Web Audio Pipeline with Server Clock Synchronization
- **Decision**: Playback is rendered directly in the web client using HTML5 `<audio>` elements piped into `SpatialAudioPipeline` (Web Audio API).
- **Synchronization**:
  - Web client computes server clock offset on connection using an NTP-style ping-pong (`clockOffset = serverTime - (clientTime + rtt / 2)`).
  - When entering an emitter's radius, client seeks directly to `trackPosition = (clientNow + clockOffset - startedAt) % duration`.
  - Micro-drift (>100ms) is corrected transparently by temporary 1-2% playbackRate adjustments.
- **Alternatives Considered**: WebRTC SFU PlainTransport with FFmpeg. While offering RTP-level sync, it demands heavy CPU for multi-track transcoding and limits audio to voice-optimized Opus bitrates.

### 2. Shared File System Architecture and HTTP 206 Streaming
- **Decision**: The Paper plugin and voice-server share access to `plugins/VoiceEngine/media/`.
  - Express serves `GET /api/media/*` supporting `Range: bytes=X-Y` requests with `HTTP 206 Partial Content`.
  - Enables instant random seeking without downloading entire multi-megabyte audio files before playback begins.
- **Alternatives Considered**: Transferring raw audio binary blobs across the WebSocket control socket. Rejected due to buffer bloat and WebSocket latency degradation for voice telemetry.

### 3. Asynchronous Remote Media Extraction & Configurable Cache
- **Decision**: Remote streams from platforms like YouTube or SoundCloud are resolved by `MediaCacheService` in `voice-server` and downloaded asynchronously to `media/cache/<hash>.mp3`.
  - Playback only begins once the file or initial chunk is buffered, guaranteeing smooth, stall-free playback and immunity to YouTube streaming link expirations.
  - Cache retention is governed by `audio.cache.max_size_mb` and `audio.cache.max_age_days` in `config.yml`, with manual in-game purges via `/voice audio cache purge`.

### 4. Acoustic Rendering Model (Linear Attenuation & Culling)
- **Decision**: 3D spatial emitters use `PannerNode.distanceModel = 'linear'`, where gain scales proportionally from 1.0 down to 0.0 at `emitter.radius`.
  - Web client evaluates listener distance: if `distance > radius`, the `<audio>` element is paused and audio nodes disconnected to free browser resources.
  - 2D global broadcasts bypass `PannerNode` entirely, connecting directly to `mediaBusGain`.

### 5. Client Volume Isolation Architecture
- **Decision**: Add a dedicated `mediaBusGain: GainNode` upstream of `masterGain` in `SpatialAudioPipeline`.
  - `proximityBusGain` (player voices) and `mediaBusGain` (music/emitters) operate in parallel.
  - Player adjustments to "Media Volume" or "Mute Media" affect only `mediaBusGain`, ensuring voice intelligibility is never compromised by background music.

```
+---------------------------------------------------------------------------------+
|                       SpatialAudioPipeline Routing Graph                        |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [ Player Voice Streams ] ----> [ Proximity Bus Gain ]                          |
|                                       |                                         |
|  [ 3D Emitter Panners ]   ----> [ Media Bus Gain ]  ----> [ Master Gain ]       |
|  [ 2D Global Emitters ]   ---->       |                          |              |
|                                       v                          v              |
|                                (Media Slider)             [ Deafen Gain ]       |
|                                                                  |              |
|                                                                  v              |
|                                                            [ Destination ]      |
+---------------------------------------------------------------------------------+
```

## Risks / Trade-offs

- **[Risk] External CDN / CORS Blocking**: Direct web audio URLs may lack CORS headers (`Access-Control-Allow-Origin: *`), causing `AudioContext` to block processing.
  - *Mitigation*: The voice server provides a transparent streaming proxy route (`/api/media/proxy?url=...`) adding the required CORS headers when external endpoints disallow cross-origin requests.
- **[Risk] Cache Disk Exhaustion**: Excessive YouTube tracks downloaded by staff could consume server storage.
  - *Mitigation*: Enforce `max_size_mb` disk quotas, automated eviction of least recently used tracks, and `/voice audio cache purge` admin command.
- **[Risk] Visual lag from particle emissions**: Too many particles from active emitters could impact client FPS.
  - *Mitigation*: Particle task operates at a throttled interval (e.g. 20 ticks) and can be toggled off globally via `config.yml` or `/voice audio particles off`.
