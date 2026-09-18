# VoiceEngine — Product & Documentation Issues Requiring Human Decisions

> **Document Status**: Active / Open for Maintainer Review  
> **Audited Date**: 2026-09-17  
> **Purpose**: This document tracks architectural, operational, and documentation discrepancies discovered during the technical audit that require human decision-making and product direction.

---

## 1. Velocity Plugin Omission in Automated Deployment (`scripts/install.sh`)

### Problem
`scripts/install.sh` automatically compiles and packages `web-client`, `voice-server`, and `paper-plugin` via Gradle, but omits `velocity-plugin`.

### Why It Matters
Administrators operating multi-server proxy networks (Velocity) who run the automated setup script will receive a compiled Paper plugin JAR in `paper-plugin/build/libs/`, but will find no artifact for Velocity. They must manually discover and execute `./gradlew build` inside `velocity-plugin`.

### Implementation Evidence
[`scripts/install.sh#L363-L374`](../scripts/install.sh#L363-L374):
```bash
log_info "--- Building Paper Plugin (paper-plugin) ---"
cd "${REPO_DIR}/paper-plugin"
...
./gradlew build -x test
log_success "Paper plugin built successfully in paper-plugin/build/libs/"
```

### Possible Approaches
* **Approach A (Recommended)**: Add an automated build block for `velocity-plugin` in `scripts/install.sh` immediately following the Paper build step, generating both artifacts.
* **Approach B**: Add an interactive prompt during the install wizard: *"Are you running a Velocity proxy? (y/n)"* and conditionally compile the module.
* **Approach C**: Keep `install.sh` focused exclusively on Paper standalone and provide a separate `install_velocity.sh` script.

### Recommendation
Adopt **Approach A**. Compiling the Velocity plugin adds less than 10 seconds to the build sequence and ensures all server artifacts are available in `build/libs/`.

### Blocks Launch?
**No**. A straightforward manual build workaround exists (`cd velocity-plugin && ./gradlew build`).

---

## 2. Java Version Discrepancy (Paper vs. Velocity vs. Documentation)

### Problem
The repository exhibited conflicting Java runtime documentation across files:
* `paper-plugin/build.gradle.kts` sets `targetJava` defaulting to `17`.
* `velocity-plugin/build.gradle.kts` sets `targetJava` defaulting to `21`.
* `docs/installation/DEPLOY.md` and `scripts/install.sh` install OpenJDK 21.
* Prior commit `06a86fb` changed README to state "Java 17+", which breaks if an operator attempts to build `velocity-plugin` using Java 17.

### Why It Matters
Server owners attempting to compile the Velocity proxy module with Java 17 will encounter a Gradle toolchain compilation error (`Velocity API 3.4.0 requires Java 21`). Conversely, Paper 1.20.4 standalone operators might assume Java 21 is strictly mandatory for the Paper JAR when Java 17 is sufficient.

### Implementation Evidence
* [`paper-plugin/build.gradle.kts#L29-L32`](../paper-plugin/build.gradle.kts#L29-L32): `.orElse(17)`
* [`velocity-plugin/build.gradle.kts#L30-L33`](../velocity-plugin/build.gradle.kts#L30-L33): `.orElse(21)`

### Possible Approaches
* **Approach A (Documentation Alignment — Adopted)**: Accurately document that `paper-plugin` targets Java 17+ (running on Minecraft 1.20.4+), `velocity-plugin` strictly requires Java 21+, and building the entire monorepo recommends Java 21 LTS.
* **Approach B (Code Change)**: Standardize both Gradle subprojects to `orElse(21)`.
* **Approach C (Code Change)**: Attempt to downgrade Velocity toolchain to Java 17 (unsupported by Velocity 3.3+ / 3.4+).

### Recommendation
Keep **Approach A**. Java 21 LTS is the modern standard for Minecraft server hosting (required by Minecraft 1.20.5+ and Velocity 3.3+). Clearly stating this in the README eliminates confusion without breaking compatibility for Java 17 Paper 1.20.4 servers.

### Blocks Launch?
**No**. Resolved via documentation clarification.

---

## 3. Absence of Root Gradle Wrapper

### Problem
The root directory contains `settings.gradle.kts` configuring both `paper-plugin` and `velocity-plugin`, but does not contain a root `gradlew` or `gradlew.bat` script.

### Why It Matters
Developers cloning the monorepo expecting standard multi-project Gradle behavior (`./gradlew build` from root) will receive a "command not found" error unless they have Gradle installed globally on their workstation.

### Implementation Evidence
* `paper-plugin/gradlew` and `paper-plugin/gradlew.bat` exist.
* `velocity-plugin/gradlew` and `velocity-plugin/gradlew.bat` exist.
* Repository root has `settings.gradle.kts` but no wrapper.

### Possible Approaches
* **Approach A (Recommended)**: Generate a root Gradle wrapper (`gradle wrapper`) so running `./gradlew build` from the repository root compiles both `paper-plugin` and `velocity-plugin` simultaneously.
* **Approach B**: Document in the Development guide that contributors must `cd` into each submodule directory.

### Recommendation
The maintainer should execute `gradle wrapper` in the root repository to provide a unified build entry point.

### Blocks Launch?
**No**. Documented in README build instructions.

---

## 4. Web Client Bundle Size & Code-Splitting Optimization

### Problem
Running `npm run build` in `web-client` produces a single JavaScript bundle chunk of ~700 kB (178 kB gzipped), triggering Vite's bundle size warning (`> 500 kB`).

### Why It Matters
Regular Minecraft players accessing `/voice` download the full bundle, including the administrative portal (`AdminRoute.tsx`, `BrandingTab`, `ChannelsTab`, `BackendTab`, `LiveMonitorTab`), which they will never view. On mobile companion devices over cellular data, this adds unnecessary initial load latency.

### Implementation Evidence
[`web-client/src/App.tsx#L4-L5`](../web-client/src/App.tsx#L4-L5) imports `AdminRoute` statically:
```tsx
import { PlayerRoute } from './routes/PlayerRoute.js';
import { AdminRoute } from './routes/AdminRoute.js';
```

### Possible Approaches
* **Approach A (Recommended)**: Convert `AdminRoute` to a dynamic import using React Lazy loading:
  ```tsx
  const AdminRoute = React.lazy(() => import('./routes/AdminRoute.js'));
  ```
  This reduces the initial player bundle to ~350 kB.
* **Approach B**: Configure manual rollup chunks in `vite.config.ts`.
* **Approach C**: Leave as-is (178 kB gzipped is still relatively light for modern broadband).

### Recommendation
Implement **Approach A** in an upcoming performance polish change.

### Blocks Launch?
**No**. 178 kB gzipped loads in under 300 ms on typical 4G/5G and broadband connections.

---

## 5. Docker Containerization for Voice Server Backend

### Problem
The voice server is currently designed for bare-metal or VPS Linux deployment using `systemd`. There is no official `Dockerfile` or `docker-compose.yml` for `voice-server`. (Docker Compose is currently only provided for Prometheus/Grafana in `monitoring/`).

### Why It Matters
Many enterprise server operators and cloud-native communities host their infrastructure entirely inside Docker containers or Kubernetes clusters (e.g. via Pterodactyl Wings or PufferPanel).

### Technical Context & Considerations
Mediasoup relies on native C++ compilation (`mediasoup-worker`) and direct host UDP networking (`--net=host`) to manage the port range `40000-49999 UDP`. Creating a Docker container requires ensuring proper C++ build toolchains (Python, GCC) in the image and using host networking mode.

### Recommendation
Evaluate publishing an official, automated multi-arch Docker image (`ghcr.io/cypherlink-studios/voiceengine:latest`) with `--net=host` documentation after public launch.

### Blocks Launch?
**No**. The native Ubuntu systemd deployment (`install.sh`) is turnkey and battle-tested.

---

## 6. External Media Streaming Tooling Dependencies

### Problem
The 3D Audio Emitter suite supports streaming remote media tracks (e.g., YouTube or web streams) using `yt-dlp` and `ffmpeg`. If these binaries are not installed, local audio playback works, but remote URL streaming fails with a warning.

### Why It Matters
Administrators might attempt to play a YouTube URL in game and wonder why it does not play if they haven't run `scripts/install_audio_tools.sh`.

### Implementation Evidence
[`voice-server/src/index.ts#L84-L98`](../voice-server/src/index.ts#L84-L98), [`scripts/install_audio_tools.sh`](../scripts/install_audio_tools.sh).

### Recommendation
Clearly distinguish between **Local File Playback** (zero extra dependencies) and **Remote URL Streaming** (requires `scripts/install_audio_tools.sh`) in the README and command documentation.

### Blocks Launch?
**No**. Clarified in the updated documentation.
