# Commands & Permissions Reference (Velocity)

The VoiceEngine Velocity plugin is built with **Incendo Cloud Velocity**, providing modern command dispatching, asynchronous permission evaluation, and native tab-completion for online player names and durations.

---

## Root Aliases

All commands on the Velocity proxy can be invoked with any of the following aliases:
- `/voice-velocity`
- `/ve-velocity`
- `/voiceengine-velocity`
- `/audio-velocity`

> [!TIP]
> If you want players to type `/voice` directly on the proxy, you can register a simple alias or command forwarder in your Velocity configuration or alias plugin (such as FastCommands) mapping `/voice` to `/voice-velocity`.

---

## Player Voice Commands

| Command | Description | Permission | Default |
| :--- | :--- | :--- | :--- |
| `/voice-velocity` | Checks active IP/UUID bans or mutes, generates a 6-character session token, registers it with the backend, and displays the clickable connection link. | `voiceengine.use` | Everyone (`true`) |

---

## Administrative Commands

| Command | Description | Permission | Default |
| :--- | :--- | :--- | :--- |
| `/voice-velocity admin` | Generates an administrative session token and opens the VoiceEngine Admin Web Portal. | `voiceengine.admin` | Proxy Admins |
| `/voice-velocity reload` | Reloads `velocity-config.yml` and updates backend WebSocket connectivity if the URI or secret changed. | `voiceengine.admin` | Proxy Admins |
| `/voice-velocity status` | Displays backend WebSocket connection state, reconnect attempts, URI, and active token count. | `voiceengine.admin` | Proxy Admins |

---

## Moderation & Staff Commands

All moderation commands require the `voiceengine.mod` permission node.

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voice-velocity kick` | `<player> [reason]` | Immediately terminates the player's web client voice session. |
| `/voice-velocity mute` | `<player> <duration> [reason]` | Mutes the player's microphone on the SFU for the specified duration (e.g. `30m`, `2h`, `perm`). |
| `/voice-velocity deafen` | `<player> <duration> [reason]` | Prevents the player from hearing audio for the specified duration. |
| `/voice-velocity ban` | `<player> <duration> [reason]` | Disconnects and bans the player's UUID and IP address from VoiceEngine. |
| `/voice-velocity unmute` | `<player>` | Revokes an active mute and restores microphone transmission. |
| `/voice-velocity undeafen` | `<player>` | Revokes an active deafen and restores audio playback. |
| `/voice-velocity unban` | `<player>` | Revokes an active ban and unblocks the player's IP address. |
| `/voice-velocity modstatus` | `<player>` | Displays active punishments, expiration countdowns, and reasons. |

---

## Permissions Breakdown

| Permission Node | Intended Role | Description |
| :--- | :--- | :--- |
| `voiceengine.use` | All Players | Allows connecting to voice chat via `/voice-velocity`. |
| `voiceengine.mod` | Helpers, Mods, Staff | Access to kick, mute, deafen, ban, and inspect player moderation status. |
| `voiceengine.admin` | Administrators | Access to the web admin portal, proxy reload, and status reporting. |

---

## LuckPerms (Velocity) Configuration Example

When using LuckPerms on Velocity:

```bash
# Allow all network players to connect to voice chat
lpv group default permission set voiceengine.use true

# Grant Trial Mods and Moderators moderation powers
lpv group mod permission set voiceengine.mod true

# Grant Network Administrators full control
lpv group admin permission set voiceengine.admin true
lpv group admin permission set voiceengine.mod true
```
