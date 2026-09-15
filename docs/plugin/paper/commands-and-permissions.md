# Commands & Permissions Reference (Paper)

The VoiceEngine Paper plugin uses the **Incendo Cloud v2** command framework with native Mojang Brigadier integration, providing real-time tab completion, argument validation, and rich syntax error handling.

---

## Command Aliases

All commands can be executed using any of the following root aliases:
- `/voice`
- `/ve`
- `/voiceengine`
- `/audio`

---

## Player Commands

| Command | Description | Permission | Default |
| :--- | :--- | :--- | :--- |
| `/voice` | Generates a 6-character session token and displays the clickable web client connection link. | `voiceengine.use` | Everyone (`true`) |

> [!NOTE]
> When `proxy-mode` is active (or set to `auto` behind Velocity/BungeeCord), the `/voice` command on Paper is suppressed in favor of the proxy command.

---

## Administrative Commands

| Command | Description | Permission | Default |
| :--- | :--- | :--- | :--- |
| `/voice admin` | Generates an administrative session token and opens the VoiceEngine Admin Web Portal. | `voiceengine.admin` | OP |
| `/voice reload` | Reloads `config.yml`, language bundles, speaker blocks, and audio emitters without restarting. | `voiceengine.admin.reload` | OP |
| `/voice status` | Displays backend WebSocket connection state, reconnect attempts, URI, and active token count. | `voiceengine.admin.status` | OP |

---

## Speaker Block Commands

All speaker block commands require the `voiceengine.admin.speaker` permission node (default: OP).

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voice speaker create` | `<id> [radius]` | Creates a new speaker block at the block you are currently looking at (within 5 blocks). Radius defaults to 30. |
| `/voice speaker remove` | `<id>` | Unregisters and removes a speaker block. |
| `/voice speaker link` | `<id> <player>` | Links an online player's microphone to the speaker, projecting their voice from the block. |
| `/voice speaker unlink` | `<id>` | Removes any active player voice link from the speaker. |
| `/voice speaker redstone` | `<id> <true\|false>` | Toggles whether the speaker requires an active Redstone power current to broadcast. |
| `/voice speaker play` | `<id> <source>` | Starts playing an audio file or stream through the speaker block. |
| `/voice speaker stop` | `<id>` | Stops current media playback on the speaker. |
| `/voice speaker list` | *None* | Lists all registered speaker blocks, world locations, radiuses, and linked players. |

---

## Audio Emitter Commands

All audio emitter commands require the `voiceengine.admin.audio` permission node (default: OP).

| Command | Arguments | Flags | Description |
| :--- | :--- | :--- | :--- |
| `/voice audio play` | `<id> <source> <x> <y> <z> [radius]` | `--loop` | Starts 3D spatial playback at specific world coordinates with optional endless looping. |
| `/voice audio broadcast` | `<id> <source>` | *None* | Starts a server-wide non-spatial audio broadcast heard equally by all players. |
| `/voice audio sfx` | `<source>` | *None* | Plays a one-shot global sound effect to all players. |
| `/voice audio sfx` | `<source> <x> <y> <z> [radius]` | *None* | Plays a one-shot positional 3D sound effect at specific coordinates. |
| `/voice audio pause` | `<id>` | *None* | Pauses an active audio emitter. |
| `/voice audio resume` | `<id>` | *None* | Resumes a paused audio emitter. |
| `/voice audio stop` | `<id>` or `all` | *None* | Stops and deletes an emitter (or all emitters). |
| `/voice audio volume` | `<id> <volume>` | *None* | Sets volume multiplier between `0.0` and `2.0` (1.0 = 100%). |
| `/voice audio list` | *None* | *None* | Lists all active audio emitters and their current playback states. |
| `/voice audio files` | *None* | *None* | Lists all audio files discovered in the backend media directory. |
| `/voice audio cache status` | *None* | *None* | Displays cached media files and total storage usage on the backend. |
| `/voice audio cache purge` | `[all\|24h\|7d\|30d]` | *None* | Cleans up cached audio files older than the specified duration. |
| `/voice audio particles` | `<on\|off\|toggle>` | *None* | Controls the visual green note particles displayed at active emitter coordinates. |

---

## Permission Nodes Summary

Add these permissions to your permission manager (LuckPerms, UltraPermissions, etc.):

```text
voiceengine.use             - Grants permission to connect to voice chat via /voice (Default: true)
voiceengine.admin           - Access to /voice admin portal (Default: OP)
voiceengine.admin.reload    - Access to /voice reload (Default: OP)
voiceengine.admin.status    - Access to /voice status (Default: OP)
voiceengine.admin.speaker   - Full control over speaker block creation and linking (Default: OP)
voiceengine.admin.audio     - Full control over audio emitters, playback, and cache (Default: OP)
```

### LuckPerms Example Setup

```bash
# Allow default players to use voice chat (enabled by default)
lp group default permission set voiceengine.use true

# Grant Moderators access to status checks
lp group mod permission set voiceengine.admin.status true

# Grant Event Team access to audio emitters and speaker blocks
lp group event_staff permission set voiceengine.admin.audio true
lp group event_staff permission set voiceengine.admin.speaker true
```
