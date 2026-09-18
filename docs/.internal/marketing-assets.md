# VoiceEngine — Marketing & Visual Asset Production Guide

> **Document Status**: Ready for Production  
> **Target Audience**: Human Marketing & Creative Team  
> **Purpose**: This guide specifies the visual assets (screenshots, screen recordings, GIFs, and diagrams) required prior to the public launch of VoiceEngine. Each asset directly corresponds to a verified product capability.

---

## Priority Overview

* **Priority P0 (Launch Blockers)**: Must be produced before publishing the repository, announcing on Reddit/Twitter/Discord, or submitting to plugin indexes.
* **Priority P1 (High Impact)**: Strongly recommended for the launch announcement, documentation enrichment, and social media reels.
* **Priority P2 (Polish & Community)**: Enhances developer trust, system administrator adoption, and extended technical documentation.

---

## Asset Specifications

### 1. Hero Onboarding Experience (GIF / Short Clip)
* **Priority**: **P0 (Launch Blocker)**
* **Purpose**: Prove in 5 seconds that VoiceEngine requires **zero client-side mods** and connects in one click.
* **Format**: High-framerate looping GIF (or WebM video, $\le 5$ MB).
* **Suggested Content**:
  1. Player types `/voice` in standard vanilla Minecraft Java Edition chat.
  2. In-game chat displays the gradient `[VoiceEngine]` prompt with a clickable link.
  3. Player clicks the link; browser opens automatically to `https://voice.yourdomain.com/?token=...`.
  4. Player clicks **"Connect Voice"** $\to$ Radar lights up with nearby players $\to$ Note particles appear above their character in Minecraft.
* **Where It Should Be Used**:
  * Top of `README.md` (Hero section).
  * Announcement tweets / social media teasers.
  * SpigotMC / BuiltByBit / Modrinth plugin page headers.

---

### 2. 3D Spatial Audio & Acoustic Immersion Demonstration (Video)
* **Priority**: **P0 (Launch Blocker)**
* **Purpose**: Showcase the auditory immersion: binaural HRTF panning, sneak whispering, and underwater damping with stereo audio.
* **Format**: 30–60 second video with binaural stereo sound (1080p60).
* **Suggested Content**:
  * **Scene A (3D Panning)**: Player A stands stationary; Player B circles Player A talking continuously. Demonstrates clear left-to-right binaural positioning.
  * **Scene B (Sneak Whispering)**: Player B steps 15 blocks away (voice fades completely). Player B stops sneaking; voice becomes audible again.
  * **Scene C (Underwater Damping)**: Player A dives into a lake while Player B is speaking. Audio immediately shifts to a muffled 600 Hz low-pass filter with water ambiance.
  * **Scene D (Atmospheric Distance Rolloff)**: Player B runs from 2 blocks to 25 blocks away; voice smoothly loses high-frequency brightness.
* **Where It Should Be Used**:
  * Embedded YouTube / stream link in `README.md`.
  * Reddit r/admincraft and r/Minecraft showcase posts.
  * Social media showcase reels.

---

### 3. Floating Picture-in-Picture (PiP) Overlay (Screenshot / Short Clip)
* **Priority**: **P1 (High Impact)**
* **Purpose**: Demonstrate that players don't need a second monitor to see who is speaking.
* **Format**: High-resolution screenshot (1920x1080) and 5-second GIF.
* **Suggested Content**:
  * Minecraft running in borderless windowed mode.
  * The native Document Picture-in-Picture window pinned neatly in the top-right corner of the Minecraft screen.
  * Mini-radar displaying nearby player icons with green speaking ripples.
  * Showing the `M` (Mute) and `D` (Deafen) hotkey indicators inside the PiP header.
* **Where It Should Be Used**:
  * `README.md` "Player Experience" section.
  * Feature carousel on marketing landing page.

---

### 4. Mobile QR Companion Experience (Lifestyle Photo / Clip)
* **Priority**: **P1 (High Impact)**
* **Purpose**: Highlight the mobile companion mode for single-monitor gamers and mobile enthusiasts.
* **Format**: Clean photograph or short live-action video clip.
* **Suggested Content**:
  * A smartphone (iPhone or Android) resting on a desk stand next to a gaming keyboard and mouse.
  * The smartphone display is glowing with the dark-mode VoiceEngine mobile radar interface, displaying the local player's avatar and speaking ring.
  * In the background, the PC monitor displays Minecraft gameplay with note particles above the player's head.
  * Demonstrates that the phone screen does not sleep thanks to the Screen Wake Lock API.
* **Where It Should Be Used**:
  * `README.md` "Mobile Companion Mode" section.
  * Community Discord announcements and social media.

---

### 5. Redstone Megaphones & Physical Speaker Blocks (Clip / GIF)
* **Priority**: **P1 (High Impact)**
* **Purpose**: Appeal to Minecraft builders, roleplay servers, and redstone engineers.
* **Format**: 10–15 second video or animated GIF.
* **Suggested Content**:
  * A town square or arena with a jukebox speaker block mounted on an obsidian pillar.
  * A player pulls a lever: Redstone dust lights up $\to$ Note particles erupt from the speaker block.
  * The linked player speaks into their microphone $\to$ Their voice echoes across the entire village plaza through the speaker block.
* **Where It Should Be Used**:
  * `docs/plugin/paper/speaker-blocks.md`.
  * Feature section of `README.md`.
  * Roleplay server outreach presentations.

---

### 6. Staff Admin Web Portal (Screenshots)
* **Priority**: **P2 (Polish & Community)**
* **Purpose**: Prove the system is a polished, enterprise-ready product with live branding controls.
* **Format**: High-resolution PNG screenshots with clean mock server data.
* **Suggested Content**:
  * **Shot 1 (Branding Tab)**: Custom accent color picker, server name editor, and custom logo preview.
  * **Shot 2 (Channels Tab)**: List of fixed channels (e.g. `Lobby Voice`, `Staff Radio`, `Event Stage`) with active member counts.
  * **Shot 3 (Live Monitor Tab)**: Grid of active connected players showing ping (ms), packet loss, and WebRTC track health.
* **Where It Should Be Used**:
  * `README.md` "Administration & Staff Portal" section.
  * SpigotMC / BuiltByBit product listing screenshots.

---

### 7. Turnkey Grafana Observability Dashboard (Screenshot)
* **Priority**: **P2 (Polish & Community)**
* **Purpose**: Build immediate trust with serious server administrators, hosting networks, and DevOps engineers.
* **Format**: Crisp 1440p/4K PNG screenshot of Grafana.
* **Suggested Content**:
  * Grafana dashboard (`voiceengine-overview.json`) populated with live benchmark data:
    - Event Loop Lag gauge sitting safely in the green (< 10 ms).
    - Active SFU Workers gauge showing multi-worker distribution.
    - Deadband suppression ratio chart showing ~79% bandwidth savings.
    - Spatial calculation latency histogram (P95 < 2 ms).
* **Where It Should Be Used**:
  * `docs/observability/PROMETHEUS_GRAFANA.md`.
  * `README.md` "Observability & Scalability" section.
  * Server administrator outreach posts.

---

### 8. System Architecture Diagram (High-Res Graphic)
* **Priority**: **P1 (High Impact)**
* **Purpose**: Communicate the full topology clearly to technical leads and developers.
* **Format**: Clean SVG vector graphic or styled high-resolution PNG.
* **Suggested Content**:
  * Four interconnected tiers:
    1. Vanilla Minecraft Java Client (Protocol).
    2. Paper / Velocity Plugin Layer (Telemetry & Moderation).
    3. Voice Server SFU Pool (Mediasoup C++ Workers & Spatial Grid).
    4. Web Browser Client (Web Audio HRTF & RNNoise WASM).
* **Where It Should Be Used**:
  * `README.md` "Architecture" section.
  * `docs/architecture/ARCHITECTURE.md`.
