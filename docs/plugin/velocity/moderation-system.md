# Voice Moderation & Punishment Subsystem

The **VoiceEngine Velocity Plugin** includes an embedded moderation engine designed to give staff tools to discipline abusive users, enforce community guidelines, and prevent harassment in voice chat across your entire server network.

---

## Architecture Overview

```
 [ Staff Member ]
        |
        | /voice-velocity mute ToxicPlayer 1h Mic spam
        v
 [ VelocityModerationService ]
        |
        +---> Writes record to SQLite (plugins/voiceengine-velocity/moderation.db)
        |     - WAL Mode (High-concurrency, crash-resilient)
        |     - Tracks UUID, IP address, staff attribution, expiration
        |
        +---> Pushes WebSocket Packet to SFU Backend
              {
                "type": "moderation_action",
                "action": "mute",
                "target": "3c98...-...",
                "enabled": true,
                "reason": "Mic spam",
                "expiresAt": 1726432800000
              }
              |
              v
       [ VoiceEngine SFU Backend ]
        - Immediately mutes the player's Producer in Mediasoup
        - Displays in-client warning banner: "Muted by staff"
```

---

## Punishment Types

| Type | Target Scope | Description |
| :--- | :--- | :--- |
| **`KICK`** | Ephemeral | Immediately cuts the player's current voice session and disconnects their browser client. The player may reconnect if not banned. |
| **`MUTE`** | UUID / IP | Silences the player's microphone on the SFU. The player can still hear other users around them, but their audio is never relayed to listeners. |
| **`DEAFEN`** | UUID / IP | Server-side deafens the player so they cannot hear voice audio or media emitters. |
| **`BAN`** | UUID & IP | Completely prevents the player from connecting to the VoiceEngine web client. If actively connected, their session is instantly terminated. |

---

## Duration Syntax

All punishment commands accept flexible human-readable durations parsed by `DurationParser`:

| Syntax | Duration |
| :--- | :--- |
| `30s` | 30 seconds |
| `15m` | 15 minutes |
| `2h` | 2 hours |
| `1d` | 1 day |
| `7d` | 7 days |
| `30d` | 30 days |
| `perm` or `permanent` | Permanent (no expiration timestamp) |

---

## Staff Commands & Usage

All moderation commands require the `voiceengine.mod` permission node.

### 1. Kicking a Player
Instantly drops a player's browser connection:
```bash
/voice-velocity kick <player> [reason]
# Example:
/voice-velocity kick BadUser Audio feedback loop
```

### 2. Muting a Player
Mutes a player's microphone across the network for a set duration:
```bash
/voice-velocity mute <player> <duration> [reason]
# Example:
/voice-velocity mute Spammer 2h Screaming in proximity
```

To unmute:
```bash
/voice-velocity unmute <player>
```

### 3. Server-Deafening a Player
Stops a player from hearing voice chat:
```bash
/voice-velocity deafen <player> <duration> [reason]
# Example:
/voice-velocity deafen DisruptiveUser 30m
```

To undeafen:
```bash
/voice-velocity undeafen <player>
```

### 4. Banning a Player (UUID & IP)
Bans a player and blacklists their IP address:
```bash
/voice-velocity ban <player> <duration> [reason]
# Example:
/voice-velocity ban TrollsRUs perm Hate speech
```

To unban:
```bash
/voice-velocity unban <player>
```

### 5. Inspecting Player Moderation Status
Inspect active punishments, expiration countdowns, and reasons for any player:
```bash
/voice-velocity modstatus <player>
```

#### Example Output
```text
[VoiceEngine] Moderation Status for Spammer:
- Mute: ACTIVE (Expires in: 1h 42m) | Reason: Screaming in proximity | Staff: ModeratorJane
- Deafen: None
- Ban: None
```

---

## Database Architecture (`moderation.db`)

Punishments are persisted in a local SQLite database at:
```text
velocity-root/
└── plugins/
    └── voiceengine-velocity/
        └── moderation.db
```

### SQLite Optimization
- **WAL Journaling**: The database runs in `PRAGMA journal_mode=WAL;` (Write-Ahead Logging), allowing concurrent non-blocking reads and rapid writes.
- **Indexed Lookups**: Lookups on `(player_uuid, punishment_type, revoked)` and `(client_ip, punishment_type, revoked)` run on binary B-Tree indexes, guaranteeing sub-millisecond connection checks even with tens of thousands of past punishment records.

### Automatic Resynchronization on Reconnect
If the VoiceEngine backend restarts or network connectivity blips, Velocity's `VelocityBackendClient` automatically detects the reconnection and pushes all currently active punishments from SQLite back into the SFU:

```java
this.backendClient.setOnConnected(() -> moderationService.syncToBackend(backendClient));
```

This guarantees that player mutes and bans are never dropped or forgotten after backend maintenance.
