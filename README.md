# VoiceEngine

> **Zero-Mod, Click-and-Connect Proximity Voice Chat for Minecraft Paper Servers**

VoiceEngine provides real-time 3D spatialized voice chat for Minecraft players with **zero client-side mods required**. Players join the server, type `/voice` (or click the welcome message), and connect instantly through a modern browser web client using the Web Audio API and WebRTC SFU.

---

## 🌟 Features

- **Zero Client Mods Needed**: Pure vanilla Minecraft compatibility (Java Edition). No Fabric, Forge, or JAR installations needed for players.
- **Click & Connect**: Type `/voice` to receive a clickable link with a secure, short-lived one-time authentication code.
- **3D Binaural Spatial Audio**: Positional audio rendered with HRTF (Head-Related Transfer Function) via the browser's Web Audio API.
- **Immersive Mechanics**:
  - **Whispering**: Sneaking (`Shift`) reduces speech radius to 8 blocks.
  - **Underwater Acoustics**: Automatically muffles audio with a low-pass filter when either player is submerged.
  - **Inter-Dimensional Isolation**: Prevents cross-dimensional leakage (Nether vs Overworld).
  - **In-Game Visual Feedback**: Musical note particles appear above speaking players' heads in Minecraft.
- **Hands-Free Background Operation**: Client-side Voice Activity Detection (VAD) with noise suppression and adjustable sensitivity.
- **Live Proximity Radar**: Clean dark-mode UI with a real-time radar showing nearby players, distance, and speaking rings.

---

## 🏗️ Architecture

```
VoiceEngine/
├── paper-plugin/       # Paper Minecraft Plugin (Java 25, Gradle Kotlin DSL)
├── voice-server/       # WebRTC SFU & Signaling Backend (TypeScript, Mediasoup)
├── web-client/         # Modern Web Application (Vite, React, Tailwind CSS)
└── openspec/           # OpenSpec Change Management & Specifications
```

---

## 🚀 Quick Start

### 1. Requirements
- Java 21+ (configured with Gradle toolchain support for Java 25)
- Node.js 20+ and npm

### 2. Voice Server (Node.js & Mediasoup)
```bash
cd voice-server
npm install
npm run build
npm start
```

### 3. Web Client (Vite + React)
```bash
cd web-client
npm install
npm run build   # Generates production assets into dist/
npm run dev     # Starts development server on http://localhost:5173
```

### 4. Paper Plugin (Java)
```bash
cd paper-plugin
./gradlew build
```
Copy `paper-plugin/build/libs/paper-plugin-1.0.0-SNAPSHOT.jar` into your Paper server's `plugins/` folder and configure `config.yml`.

---

## 🧪 Testing Without Minecraft (Mock Telemetry)

You can test the entire 3D proximity voice experience without running a Minecraft server:

1. Start the Voice Server:
   ```bash
   cd voice-server
   npm run dev
   ```
2. In a separate terminal, launch the mock telemetry simulator:
   ```bash
   cd voice-server
   npm run mock
   ```
   This will simulate 4 players ("Steve", "Alex", "Submariner", "Ninja") moving and orbiting in real time and register test codes:
   - `STEVE1` (Steve)
   - `ALEX01` (Alex)
   - `SUBM01` (Submariner)
   - `NINJA1` (Ninja)
3. Open `http://localhost:3000/?token=STEVE1` in your browser, click **Connect Voice**, and watch the live radar track nearby players in 3D!
