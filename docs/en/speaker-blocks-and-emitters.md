---
title: Speaker Blocks and Emitters
description: 3D dynamic positional emitters, physical amplified world blocks, Redstone megaphones, and media stream caching.
sidebar:
  order: 5
---

VoiceEngine includes two specialized subsystems for playing and routing audio within Minecraft: **Physical Speaker Blocks** and **Dynamic 3D Audio Emitters**.

---

## Physical Speaker Blocks

Speaker blocks allow turning any block in the world (such as a jukebox, note block, or decorative block) into a physical acoustic emitter in 3D space.

### Key Capabilities
1. **Custom Broadcast Radius**: From small intimate rooms (5 blocks) to sprawling stadium megaphones (100+ blocks).
2. **Player Megaphone Link**: Linking a player with `/voice speaker link <id> <player>` projects their microphone voice from the block's world coordinates across the full radius.
3. **Redstone Power Integration**: Toggle whether the speaker requires active Redstone power to broadcast (`/voice speaker redstone <id> true`).
4. **Media Stream Playback**: Play localized music tracks, audio files, or live streams through the block with real-time clock synchronization.

### Town Square Megaphone Example
```bash
# 1. Look at the jukebox block in the town square:
/voice speaker create town_square 50

# 2. Configure it to only broadcast when a Redstone lever is flipped ON:
/voice speaker redstone town_square true

# 3. Link the event presenter's voice:
/voice speaker link town_square Steve
```

---

## Dynamic 3D Audio Emitters

Positional audio emitters let server admins and plugins spawn spatial audio sources at arbitrary `(x, y, z)` coordinates, or trigger non-spatial 2D server-wide broadcasts.

### Playback Types
- **3D Spatial (`/voice audio play`)**: Audio is rendered binaurally relative to the player's head and ears. As players walk around or rotate, sound smoothly pans in 3D space and falls off over distance.
- **Global 2D Broadcast (`/voice audio broadcast`)**: Heard uniformly across all connected players with equal volume regardless of world position.
- **One-Shot SFX (`/voice audio sfx`)**: Triggers an instantaneous sound effect (spatial or global) without continuous looping.

### Supported Media Formats
- **Local Files**: Any audio file placed inside the backend's `media/` folder.
- **Direct HTTP/HTTPS Audio URLs**: Direct `.mp3`, `.ogg`, `.flac`, or `.wav` streams.
- **External Media Links**: Supported via `ffmpeg` transcoding on the backend SFU.

```bash
# Play looping 3D tavern music at specific coordinates:
/voice audio play tavern_music https://myserver.com/audio/tavern.mp3 120 64 -350 25 --loop

# Pause and resume playback:
/voice audio pause tavern_music
/voice audio resume tavern_music

# Adjust volume to 70%:
/voice audio volume tavern_music 0.7
```

---

## LRU Media Caching Engine

The backend voice server manages an automated LRU disk cache to eliminate repeated media downloads:

- Downloaded streams are indexed by a content hash.
- `/voice audio cache status` outputs storage usage and cached items.
- `/voice audio cache purge 24h` safely deletes audio files that have not been played within the past 24 hours.
