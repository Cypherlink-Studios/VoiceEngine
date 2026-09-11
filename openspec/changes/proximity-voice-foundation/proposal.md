## Why

Traditional Minecraft proximity voice chat mods (e.g. Simple Voice Chat, Plasmo Voice) require every player to install client-side mod loaders and JAR files, creating significant friction and excluding pure vanilla players. VoiceEngine solves this by providing a "zero mods needed" proximity voice chat experience using PaperMC, a dedicated Node.js WebRTC SFU, and a modern "click-and-connect" browser client with Web Audio API 3D binaural spatialization.

## What Changes

- **Paper Minecraft Plugin (`paper-plugin`)**: Built with Java 25 and Gradle (Kotlin DSL). Captures player coordinates, orientation, sneak state, and water submersion; streams updates at 10-15 Hz to the backend; handles `/voice` link generation and displays in-game visual speaking indicators.
- **Voice Backend Server (`voice-server`)**: Built with Node.js, TypeScript, and Mediasoup (WebRTC SFU). Handles one-time token authentication, spatial proximity calculation/culling (~30 blocks normal, ~8 blocks sneak), WebSocket telemetry routing, and serves the web client.
- **Modern Web Client (`web-client`)**: Built with Vite, React (TypeScript), and Tailwind CSS. Connects to the SFU, processes microphone input with Voice Activity Detection (VAD) and noise suppression, renders 3D spatialized audio with HRTF via Web Audio API, and displays a proximity radar and volume controls.

## Capabilities

### New Capabilities
- `paper-voice-bridge`: Paper plugin integration for player spatial tracking, one-time connection token generation, `/voice` command, and in-game speech feedback.
- `voice-backend-sfu`: Real-time Node.js/TypeScript backend managing Mediasoup WebRTC SFU routing, token validation, dynamic proximity culling, and plugin WebSocket telemetry.
- `web-client-spatial-audio`: Browser-based voice client featuring zero-mod click-and-connect onboarding, VAD microphone transmission, and Web Audio API 3D binaural spatialization.

### Modified Capabilities
<!-- None: Greenfield project -->

## Impact

- **New Projects/Directories**:
  - `paper-plugin/`: Java 25 PaperMC plugin.
  - `voice-server/`: TypeScript Node.js backend with Mediasoup native bindings.
  - `web-client/`: React + Vite SPA.
- **Dependencies**:
  - PaperMC API 1.21+, Java 25 toolchain, Gradle Kotlin DSL.
  - Node.js 20+, `mediasoup`, `ws`, `express` (or `fastify`).
  - React 19, `mediasoup-client`, Tailwind CSS.
- **Network Requirements**:
  - Outbound/Inbound WebSocket connection between Paper server and Voice server.
  - WebRTC UDP port ranges on Voice server for media streams.
  - HTTPS / WSS endpoint for browser microphone access.
