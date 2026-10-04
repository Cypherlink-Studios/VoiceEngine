---
title: Moderation and Security
description: Embedded SQLite WAL moderation database, network punishments, IP evasion prevention, and instant SFU synchronization.
sidebar:
  order: 6
---

VoiceEngine's moderation architecture safeguards player communities from toxicity, harassment, and mic spam with centralized staff controls on Velocity and millisecond-level enforcement.

---

## Embedded SQLite Database (WAL Mode)

On the Velocity proxy, VoiceEngine stores disciplinary records in an embedded SQLite database (`moderation.db`) operating in **Write-Ahead Logging (WAL)** mode:

- **Zero External Dependencies**: No external MySQL, MariaDB, or PostgreSQL configuration required.
- **Asynchronous Queries**: IP and UUID sanction checks execute off the main proxy thread without inducing tick latency.
- **High Concurrency**: Simultaneous read and write access with sub-millisecond query performance.

---

## Sanction Types

| Sanction | Immediate Web Browser Action | Persistence | IP Defense |
| :--- | :--- | :--- | :--- |
| **Kick** (`/voice-velocity kick`) | Closes the WebRTC session and disconnects the user's web client. | Transient. Player may reconnect with a new token if not banned. | N/A |
| **Mute** (`/voice-velocity mute`) | Pauses the player's microphone audio producer on the SFU. The player can still hear other voices. | Temporary or permanent. | UUID bound. |
| **Deafen** (`/voice-velocity deafen`)| Disconnects inbound audio consumers. The player cannot hear anyone in voice chat. | Temporary or permanent. | UUID bound. |
| **Ban** (`/voice-velocity ban`) | Closes the web session immediately and locks out future connection token generation. | Temporary or permanent. | Tracks and blocks both **Minecraft UUID** and **IP address**. |

---

## IP Ban-Evasion Prevention

When staff apply a ban using `/voice-velocity ban <player> <duration> <reason>`:

1. The moderation engine binds the target account's UUID and the connection IP address recorded by Velocity.
2. If the punished user attempts to bypass the sanction using an alternate account (alt account) from the same household or IP address, `/voice` rejects token generation:
   ```text
   [VoiceEngine] You cannot connect to voice chat because your IP address is suspended.
   ```
3. Executing `/voice-velocity unban <player>` revokes the ban and unblocks the associated IP address.

---

## Instant SFU Synchronization

Rather than waiting for token timeouts or polling intervals:

```
[Staff executes /voice-velocity mute Steve 1h MicSpam]
         │
         ▼
[Velocity Plugin] ─── WebSocket Payload ───> [Voice Backend SFU]
                                                     │
                                                     ▼ (0 ms)
                                  [Immediate mediasoup Producer Pause]
                                                     │
                                                     ▼ (WebSocket Push)
                                  [Modal notification on Steve's Web Client]
```

The punished player's microphone is muted on the SFU instantly without requiring a page refresh, and their web client shows an active penalty dialog detailing the reason and expiration time.
