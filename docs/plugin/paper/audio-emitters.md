# Audio Emitters & Media Playback

The **Audio Emitter System** enables server administrators to stream music, atmospheric ambiance, and directional sound effects into the Minecraft world. Emitters can be placed at fixed coordinates in 3D space or broadcast globally to all players.

---

## Audio Types Overview

```
                      [ Audio Types ]
                             |
         +-------------------+-------------------+
         |                                       |
         v                                       v
  [ 3D Spatial Emitters ]               [ Global Broadcasts ]
  - Tied to world (X, Y, Z)             - Not affected by distance
  - Attenuates with distance            - Heard equally by all players
  - Directional stereo panning          - Perfect for server-wide music,
  - Ambient taverns, boss arenas          announcements, or cutscenes
```

---

## Media Files & Supported Formats

VoiceEngine supports both **local media files** and **direct web URLs**:

- **Supported Audio Formats**: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac`, `.flac`.
- **Local Media Directory**:
  Place audio files into the backend media directory:
  ```text
  voiceengine-backend/
  └── media/
      ├── ambient/
      │   └── tavern.mp3
      ├── sfx/
      │   └── victory_horn.ogg
      └── music/
          └── boss_theme.mp3
  ```
- **Web Streams & URLs**: You can pass direct HTTPS stream links (e.g. `https://radio.example.com/stream.mp3`) as the source argument.

---

## Command Reference

All commands require the `voiceengine.admin.audio` permission (default: OP).

### 1. Playing 3D Spatial Audio

Play an audio file or stream at specific world coordinates:

```bash
/voice audio play <id> <source> <x> <y> <z> [radius] [--loop]
```

#### Arguments
- `id`: A unique alphanumeric identifier for this emitter (e.g. `tavern_music`, `fountain_sfx`).
- `source`: Relative path to a local media file (e.g. `"ambient/tavern.mp3"`) or a full URL. Use quotes if paths contain spaces.
- `x`, `y`, `z`: Coordinate values. You can use your current player position.
- `radius` *(Optional)*: Maximum hearing distance in blocks (default: `30.0`, range: `1.0` to `1000.0`).
- `--loop` *(Optional)*: Flag indicating whether the track should repeat endlessly.

#### Example
```bash
# Play looping tavern ambiance within a 45-block radius
/voice audio play tavern_main "ambient/tavern.mp3" 124 64 -850 45 --loop
```

---

### 2. Global Broadcasts

Stream an audio source to all connected players across the entire server, unaffected by distance or player position:

```bash
/voice audio broadcast <id> <source>
```

#### Example
```bash
/voice audio broadcast event_intro "music/event_start.mp3"
```

---

### 3. One-Shot Sound Effects (SFX)

Trigger a temporary, non-looping sound effect that automatically unregisters when playback finishes:

#### Global SFX (All Players)
```bash
/voice audio sfx <source>
# Example:
/voice audio sfx "sfx/thunder_clap.ogg"
```

#### Positional SFX (3D Spatial)
```bash
/voice audio sfx <source> <x> <y> <z> [radius]
# Example:
/voice audio sfx "sfx/explosion.ogg" 100 65 200 60
```

---

### 4. Emitter Control (Pause, Resume, Stop, Volume)

```bash
# Pause an active emitter without losing track position
/voice audio pause <id>

# Resume a paused emitter
/voice audio resume <id>

# Stop and remove an active emitter
/voice audio stop <id>

# Stop ALL currently active emitters at once
/voice audio stop all

# Adjust volume dynamically (0.0 to 2.0, where 1.0 is 100%)
/voice audio volume <id> <volume>
# Example: Set tavern music to 50% volume
/voice audio volume tavern_main 0.5
```

---

### 5. Media Listing & Inspection

```bash
# List all active emitters, positions, radiuses, and states
/voice audio list

# List all available media files detected in the backend media directory
/voice audio files
```

---

### 6. Visual Particles & Staff Debugging

When managing spatial audio in a large city or dungeon, it helps to see exactly where sound emitters are anchored:

```bash
/voice audio particles <on|off|toggle>
```

When enabled, active 3D emitters display green musical note particles at their $(X, Y, Z)$ coordinates.

---

### 7. Backend Media Cache Management

When streaming audio files or downloading external audio via `yt-dlp` / FFmpeg, the backend caches processed media. You can monitor and purge this cache directly from in-game:

```bash
# View current cache size and stored media files
/voice audio cache status

# Purge cached files
/voice audio cache purge [duration]
# Options: all, 24h, 7d, 30d
/voice audio cache purge 7d
```

---

## Emitter Persistence (`audio.yml`)

When `audio.persistence-enabled: true` in `config.yml`, any spatial emitter created with `/voice audio play` is saved to `plugins/VoiceEngine/audio.yml`:

```yaml
emitters:
  tavern_main:
    source: "ambient/tavern.mp3"
    world: "world"
    x: 124.0
    y: 64.0
    z: -850.0
    radius: 45.0
    volume: 0.8
    loop: true
```

When the server restarts or reloads, all emitters are automatically recreated and resumed at their designated locations.
