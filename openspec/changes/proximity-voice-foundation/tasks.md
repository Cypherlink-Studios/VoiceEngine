## 1. Project Scaffolding & Module Setup

- [x] 1.1 Initialize monorepo directory layout (`paper-plugin/`, `voice-server/`, `web-client/`) and verify directory structure.
- [x] 1.2 Setup `paper-plugin` Gradle build with Kotlin DSL targeting Java 25 and PaperMC API, verifying `./gradlew tasks` executes successfully.
- [x] 1.3 Setup `voice-server` Node.js TypeScript project with Mediasoup, Express, and WebSocket dependencies, verifying `npm run build` compiles cleanly.
- [x] 1.4 Setup `web-client` Vite + React + Tailwind CSS project with `mediasoup-client`, verifying `npm run build` generates production assets.

## 2. Paper Plugin Implementation (Java 25)

- [x] 2.1 Implement `/voice` command and cryptographically secure one-time session token manager with TTL, verifying token generation unit tests.
- [x] 2.2 Implement player spatial state listener tracking position (X, Y, Z), rotation (yaw, pitch), world, sneaking, and submersion, verifying telemetry serialization.
- [x] 2.3 Implement authenticated WebSocket client for Paper connecting to `voice-server` with exponential backoff reconnection, verifying connection lifecycle.
- [x] 2.4 Implement in-game speech visual feedback handler spawning subtle particle indicators above speaking players, verifying packet/event handling.

## 3. Voice Backend SFU & Spatial Engine

- [x] 3.1 Implement Mediasoup SFU worker initialization, WebRTC audio router, and transport creation in `voice-server`, verifying worker bootstrap.
- [x] 3.2 Implement authenticated plugin WebSocket gateway, secret validation, and telemetry batch ingestion, verifying handshake and message handling.
- [x] 3.3 Implement 3D spatial culling engine calculating Euclidean distance, sneak whisper attenuation, and dimensional isolation, verifying with spatial math tests.
- [x] 3.4 Implement dynamic WebRTC audio consumer subscription management based on spatial proximity, verifying selective forwarding logic.

## 4. Modern Web Client & Spatial Audio

- [x] 4.1 Implement "Click and Connect" onboarding UI handling URL token authentication and displaying player Minecraft skin/name, verifying UI state.
- [x] 4.2 Implement Web Audio API binaural pipeline with HRTF `PannerNode` and underwater low-pass `BiquadFilterNode`, verifying audio graph initialization.
- [x] 4.3 Implement Voice Activity Detection (VAD) with microphone test meter, noise gate, and automatic stream muting, verifying VAD threshold detection.
- [x] 4.4 Implement interactive proximity radar component showing nearby players, directional headings, and live speaking rings, verifying radar UI updates.

## 5. Integration & Validation

- [x] 5.1 Create mock telemetry generator and integration test harness to simulate multi-player voice proximity without requiring a live Minecraft server, verifying multi-listener spatial panning.
- [x] 5.2 Validate OpenSpec change specifications and schemas via `openspec validate --change proximity-voice-foundation`.
