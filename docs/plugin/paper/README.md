# VoiceEngine Paper Plugin — User Guide

Welcome to the comprehensive user guide for the **VoiceEngine Paper Plugin**. This plugin connects Minecraft (Paper / Purpur / Folia-compatible servers) to the high-performance VoiceEngine WebRTC backend, providing zero-mod proximity voice chat, 3D spatial positional audio, physical world speaker blocks, and an administrative media emitter suite.

---

## High-Level Architecture

The Paper plugin acts as the primary in-game spatial sensor and audio orchestrator. It samples player coordinates, head rotations, and world environments in real time, streaming them via secure WebSocket to the VoiceEngine SFU backend.

```
 +-------------------------------------------------------------+
 |                    Minecraft Client (Vanilla)               |
 +------------------------------+------------------------------+
                                | Standard MC Protocol
                                v
 +-------------------------------------------------------------+
 |                   Paper Server (VoiceEngine)                |
 |                                                             |
 |   +--------------------+              +-----------------+   |
 |   | Telemetry Service  |              | Speaker Manager |   |
 |   | (10-15 Hz Sampling)|              | (World Blocks)  |   |
 |   +---------+----------+              +--------+--------+   |
 |             |                                  |            |
 |             +----------------+-----------------+            |
 |                              |                              |
 |                              v                              |
 |                  [ VoiceBackendClient (WS) ]                |
 +------------------------------+------------------------------+
                                | WebSocket (Telemetry & Control)
                                v
 +-------------------------------------------------------------+
 |                 VoiceEngine SFU Backend (Node.js)           |
 |     (3D Spatial Grid Hashing, Mediasoup WebRTC Workers)     |
 +------------------------------+------------------------------+
                                ^
                                | WebRTC Media / Data Channel
                                v
 +-------------------------------------------------------------+
 |                Web Voice Client (Browser)                   |
 |       (Web Audio 3D Panner, Proximity Audio Stream)         |
 +-------------------------------------------------------------+
```

---

## Key Features

- **Zero Client Mods**: Players connect using standard web browsers (Chrome, Firefox, Safari, Edge) on desktop or mobile devices via a single click or 6-character code.
- **High-Rate Spatial Telemetry**: Collects 3D coordinates $(X, Y, Z)$, pitch, yaw, world dimension, sneaking state, and submersion state at 10–15 Hz.
- **Dynamic 3D Audio Emitters**: Play spatial ambient audio, environmental sounds, directional effects, or server-wide music broadcasts directly in the game world.
- **Physical Speaker Blocks**: Turn in-game blocks (jukeboxes, note blocks) into amplified audio broadcast stations, complete with Redstone circuit triggering and live microphone relay.
- **Visual Speech Indicators**: Subtle in-game particle effects above speaking players and active speaker blocks when voice activity is detected by the server.
- **Smart Proxy Delegation**: Automatically detects BungeeCord/Velocity forwarding modes and delegates `/voice` connection management to the proxy layer to prevent duplicate notices and command conflicts.
- **Developer API**: First-class Bukkit ServicesManager integration and custom event bus for third-party plugin extensions.

---

## Documentation Index

Explore the modular sections of this user guide:

| Guide | Description |
| :--- | :--- |
| **[Getting Started](./getting-started.md)** | Prerequisites, installation steps, and verifying backend connectivity. |
| **[Configuration](./configuration.md)** | Detailed breakdown of `config.yml`, network settings, and proxy mode. |
| **[Telemetry & Spatial Audio](./telemetry-and-spatial.md)** | How player coordinates are tracked, batched, and calculated. |
| **[Audio Emitters & SFX](./audio-emitters.md)** | Playing 3D audio tracks, spatial radiuses, volume, looping, and cache purging. |
| **[Speaker Blocks](./speaker-blocks.md)** | Creating speaker blocks, player microphone linking, and Redstone logic. |
| **[Commands & Permissions](./commands-and-permissions.md)** | Complete reference table of all in-game commands, arguments, and nodes. |
| **[Developer API](./developer-api.md)** | Interfacing with `VoiceEngineAPI`, custom events, and code examples. |
