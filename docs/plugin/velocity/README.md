# VoiceEngine Velocity Proxy Plugin — User Guide

Welcome to the documentation for the **VoiceEngine Velocity Plugin**. Designed specifically for modern Minecraft proxy networks powered by [Velocity](https://papermc.io/software/velocity), this plugin serves as the centralized authentication gateway, session coordinator, and network-wide voice moderation hub for VoiceEngine.

---

## The Role of Velocity in VoiceEngine

In a multi-server network (e.g. Hub, Survival, Minigames, Bedwars), having players reconnect their browser voice chat every time they switch servers creates friction. 

The Velocity plugin solves this by acting as the **top-level voice gateway**:

```
 +-------------------------------------------------------------+
 |                         Minecraft Players                   |
 +------------------------------+------------------------------+
                                | Connect to Velocity Proxy
                                v
 +-------------------------------------------------------------+
 |                       Velocity Proxy                        |
 |                                                             |
 |   [ VoiceEngine Velocity Plugin ]                           |
 |    * Handles /voice for the entire network                  |
 |    * Centralized SQLite Moderation Engine (moderation.db)   |
 |    * Enforces IP & UUID bans, mutes, deafens                |
 |    * Tracks server transitions (Lobby -> SMP -> Minigames)  |
 +------------------------------+------------------------------+
                                | WebSocket (Moderation & Auth)
                                v
 +-------------------------------------------------------------+
 |                 VoiceEngine SFU Backend                     |
 |    * Maintains persistent WebRTC voice session              |
 |    * Receives real-time mute/ban enforcement                |
 +-------------------------------------------------------------+
```

---

## Key Features

- **Network-Wide Voice Session**: Players run `/voice` once upon joining the network. When they switch between backend Paper servers (e.g., from `lobby` to `survival`), their voice chat never disconnects.
- **Centralized Authentication**: Velocity generates and validates 6-character connection tokens with configurable TTL, tracking player IP addresses for rate-limiting and access control.
- **Embedded SQLite Moderation Engine**: High-performance local SQLite database (`moderation.db`) running in Write-Ahead Logging (WAL) mode. Records all bans, mutes, deafens, and kicks with staff attribution and expiration timestamps.
- **Instant SFU Synchronization**: When staff mute or ban an offending player, the action is pushed immediately over WebSocket (`moderation_action`). The backend SFU mutes or disconnects the player's web client within milliseconds.
- **IP & UUID Enforcement**: Prevents banned or muted players from circumventing penalties on alternate accounts using the same IP address.
- **MiniMessage Formatting**: Fully customizable join announcements with gradients, clickable links, and hover text.

---

## Documentation Index

Explore the modular sections of this Velocity guide:

| Guide | Description |
| :--- | :--- |
| **[Getting Started](./getting-started.md)** | Installing on Velocity, pairing with backend Paper servers, and first boot. |
| **[Configuration](./configuration.md)** | Complete breakdown of `velocity-config.yml` and join message formatting. |
| **[Moderation System](./moderation-system.md)** | SQLite database architecture, punishment types (`MUTE`, `DEAFEN`, `BAN`, `KICK`), duration syntax, and backend sync. |
| **[Commands & Permissions](./commands-and-permissions.md)** | Complete reference of proxy commands, staff moderation tools, and permissions. |
| **[Network Topology & Server Switching](./proxy-topology.md)** | How Velocity coordinates seamless cross-server transitions with backend Paper instances. |
