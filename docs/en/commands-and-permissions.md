---
title: Commands and Permissions
description: Complete command trees and permission nodes for Paper servers and Velocity proxies with native tab completion.
sidebar:
  order: 4
---

VoiceEngine uses the **Incendo Cloud v2** command framework featuring native Mojang Brigadier integration on Paper and Cloud Velocity on the proxy, delivering real-time asynchronous tab completion and argument parsing.

---

## Paper Server Commands

### Root Aliases
Any of the following command aliases can be used interchangeably:
`/voice`, `/ve`, `/voiceengine`, `/audio`.

### Player & Admin Commands

| Command | Permission | Default | Description |
| :--- | :--- | :--- | :--- |
| `/voice` | `voiceengine.use` | Everyone (`true`) | Generates a 6-character session token and prints the clickable web client connection URL. |
| `/voice admin` | `voiceengine.admin` | OP | Generates an admin token and opens the VoiceEngine Web Admin Portal. |
| `/voice reload` | `voiceengine.admin.reload` | OP | Reloads `config.yml`, language bundles, speaker blocks, and emitters on the fly. |
| `/voice status` | `voiceengine.admin.status` | OP | Displays backend WebSocket connection state, reconnect attempts, and active tokens. |

### Speaker Block Commands (`/voice speaker`)

Requires the `voiceengine.admin.speaker` permission node (default: OP):

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voice speaker create` | `<id> [radius]` | Registers the target block you are looking at as a speaker with configurable radius (default: 30). |
| `/voice speaker remove` | `<id>` | Unregisters and deletes the speaker block. |
| `/voice speaker link` | `<id> <player>` | Links an online player's microphone to the speaker, projecting their voice from the block. |
| `/voice speaker unlink` | `<id>` | Unlinks any active player microphone from the speaker. |
| `/voice speaker redstone` | `<id> <true\|false>` | Toggles whether the speaker requires an active Redstone power current to broadcast. |
| `/voice speaker play` | `<id> <source>` | Starts audio track playback through the speaker block. |
| `/voice speaker stop` | `<id>` | Stops audio playback on the speaker. |
| `/voice speaker list` | *None* | Lists all registered speaker blocks, locations, radiuses, and linked players. |

### Audio Emitter Commands (`/voice audio`)

Requires the `voiceengine.admin.audio` permission node (default: OP):

| Command | Arguments | Flags | Description |
| :--- | :--- | :--- | :--- |
| `/voice audio play` | `<id> <source> <x> <y> <z> [radius]` | `--loop` | Starts 3D spatial playback at specific world coordinates with optional looping. |
| `/voice audio broadcast` | `<id> <source>` | *None* | Starts a server-wide 2D non-spatial broadcast heard equally by all players. |
| `/voice audio sfx` | `<source> [x y z [radius]]` | *None* | Plays a one-shot sound effect (global or at specific coordinates). |
| `/voice audio pause` | `<id>` | *None* | Pauses playback on an active audio emitter. |
| `/voice audio resume` | `<id>` | *None* | Resumes a paused emitter. |
| `/voice audio stop` | `<id>\|all` | *None* | Stops and removes an emitter (or all emitters). |
| `/voice audio volume` | `<id> <volume>` | *None* | Adjusts emitter volume multiplier between `0.0` and `2.0` (1.0 = 100%). |
| `/voice audio cache status` | *None* | *None* | Displays cached audio files and disk usage on the backend. |
| `/voice audio cache purge` | `[all\|24h\|7d\|30d]` | *None* | Deletes cached audio files older than the specified duration. |
| `/voice audio particles` | `<on\|off\|toggle>` | *None* | Toggles green visual note particles at active emitter locations. |

---

## Velocity Proxy Commands

### Proxy Aliases
`/voice-velocity`, `/ve-velocity`, `/voiceengine-velocity`, `/audio-velocity`.

### Moderation Commands

Requires the `voiceengine.mod` permission node (Staff / Moderators):

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voice-velocity kick` | `<player> [reason]` | Immediately terminates the player's web client voice session. |
| `/voice-velocity mute` | `<player> <duration> [reason]` | Mutes the player's microphone on the SFU for a duration (e.g. `30m`, `2h`, `perm`). |
| `/voice-velocity deafen` | `<player> <duration> [reason]` | Prevents the player from hearing audio for the specified duration. |
| `/voice-velocity ban` | `<player> <duration> [reason]` | Disconnects and bans the player's UUID and IP address from VoiceEngine. |
| `/voice-velocity unmute` | `<player>` | Revokes an active mute and restores microphone transmission. |
| `/voice-velocity undeafen`| `<player>` | Revokes an active deafen sanction. |
| `/voice-velocity unban` | `<player>` | Revokes a ban and unblocks the player's IP address. |
| `/voice-velocity modstatus` | `<player>` | Displays active punishments, expiration countdowns, and reasons. |

---

## LuckPerms Setup Example

```bash
# Allow standard players on Paper and Velocity
lp group default permission set voiceengine.use true

# Velocity staff group permissions
lpv group mod permission set voiceengine.mod true

# Administrator permissions on Paper
lp group admin permission set voiceengine.admin true
lp group admin permission set voiceengine.admin.speaker true
lp group admin permission set voiceengine.admin.audio true
```
