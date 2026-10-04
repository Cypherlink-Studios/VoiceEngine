---
title: Introduction to VoiceEngine
description: Browser-based 3D proximity voice chat and media streaming engine for Minecraft Paper servers and Velocity networks without client-side mods.
sidebar:
  order: 1
---

**VoiceEngine** is a comprehensive 3D positional voice chat and audio streaming system for Minecraft servers (Paper standalone and Velocity networks). Unlike traditional voice chat solutions, **it completely eliminates client-side mod requirements** (Fabric, Forge, NeoForge).

Players connect to your server using the official vanilla Minecraft Java Edition client, type `/voice` in chat, and click a secure connection link to open the high-performance web client in any modern desktop or mobile browser. Audio is transported via **WebRTC** and routed through a **mediasoup** Selective Forwarding Unit (**SFU**).

---

## Key Features

### 3D Spatial Audio & Immersion
- **Binaural 3D Audio**: High-fidelity positional audio rendered with the browser's native **Web Audio API** and Head-Related Transfer Function (`HRTF`) algorithms.
- **Atmospheric Air Absorption**: Dynamic low-pass frequency rolloff simulating acoustic air dampening (20 kHz down to 3.5 kHz) over physical block distance.
- **Underwater Acoustic Damping**: Automatic 600 Hz low-pass biquad filter applied when either interlocutor is submerged in water.
- **Sneak Whispering**: Crouching (`Shift`) dynamically compresses the audible voice radius from 30 blocks down to 8 blocks.
- **Inter-Dimensional Isolation**: Strict room partitioning across Overworld, Nether, and The End.
- **Spectator Modes**: Configurable spectator behavior (`listen-only`, `isolated`, `all`) tailored for minigames, events, and tournaments.

### Client-Side Microphone DSP
- **Neural Noise Suppression (RNNoise)**: WebAssembly AudioWorklet with SIMD detection eliminating keyboard clicks, computer fans, and room reverb.
- **80 Hz High-Pass Filter**: Removes desk rumbles, breath pops, and sub-bass vibrations.
- **Soft-Knee Dynamic Compressor & Limiter**: Automatically controls volume peaks to prevent digital distortion and clipping.
- **Unthrottled Background VAD**: Dedicated inline Web Worker timer (40 Hz) driving Voice Activity Detection, completely immune to browser tab throttling when Minecraft is running in fullscreen.

### In-World Mechanics & Media Emitters
- **Speech Particle Indicators**: Green musical note particles appear above speaking players' heads in real time.
- **Physical Speaker Blocks**: World blocks (such as jukeboxes or note blocks) registered as amplified broadcast speakers with custom radiuses and Redstone signal toggling.
- **Dynamic 3D Audio Emitters**: Positional music playback, one-shot sound effects, or 2D global server broadcasts initiated via commands.
- **LRU Media Caching**: Automatic downloading and disk caching for remote media streams and audio files.

### Network Scalability & Moderation
- **Native Velocity Proxy Support**: Single authentication upon joining the network; players stay in active calls seamlessly while switching backend Paper servers.
- **Embedded SQLite Moderation Engine (WAL)**: Persistent sanctions (`kick`, `mute`, `deafen`, `ban`) with UUID and IP tracking to prevent ban evasion.
- **Zero-Latency SFU Sync**: Staff actions push immediately via WebSocket, muting or disconnecting the browser in milliseconds.
- **Proximity Radar & Picture-in-Picture (PiP)**: Live circular radar canvas visualizing nearby players and floating HUD overlay pinned over Minecraft with `M` (Mute) and `D` (Deafen) hotkeys.

---

## Connection Architecture

```
┌─────────────────┐       Token /ws/plugin       ┌──────────────────────┐
│  Minecraft      │ ───────────────────────────> │  Voice Server (SFU)  │
│  Paper/Velocity │ <─────────────────────────── │  Node.js + mediasoup │
└─────────────────┘     Sanctions / Telemetry    └──────────────────────┘
         │                                                   │
   /voice Link                                       WebRTC Audio Tracks
         │                                           & WebSocket /ws/client
         ▼                                                   │
┌────────────────────────────────────────────────────────────▼──┐
│ Player Web Browser (Web Client)                                │
│ - WebRTC Audio Consumer/Producer                               │
│ - DSP: RNNoise WASM + High-Pass Filter + Dynamic Compressor    │
│ - Web Audio API: PannerNode HRTF 3D + Acoustic Air Rolloff     │
└───────────────────────────────────────────────────────────────┘
```

:::note
To get started with server installation and network setup, proceed to the [Getting Started](./getting-started) guide.
:::
