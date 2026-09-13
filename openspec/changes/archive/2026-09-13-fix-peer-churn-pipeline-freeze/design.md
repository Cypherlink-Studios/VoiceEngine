## Context

See `proposal.md` for motivation. Currently, in `ClientGateway.ts`, the proximity evaluation loop runs at 10 Hz (every 100ms). The fixed-channel routing logic was accidentally nested inside `if (channel === 'proximity')`. Because all players in proximity mode match the channel filter, the server continuously creates fixed-channel consumers and then deletes them in the proximity culling step if they are beyond 30 blocks away.

Furthermore, every consumer destruction and creation forces Mediasoup-client on the web browser to renegotiate SDP (`setLocalDescription` + `setRemoteDescription`), reconstruct Web Audio nodes (HRTF `PannerNode`, `BiquadFilterNode`, `MediaStreamAudioSourceNode`), and create/destroy DOM `<audio>` elements playing out to Windows WASAPI.

## Goals / Non-Goals

**Goals:**
- Eliminate the 10 Hz thrashing loop by strictly isolating proximity routing from fixed channel routing.
- Implement consumer pausing (`consumer.pause()`) and resuming (`consumer.resume()`) for proximity distance culling, keeping WebRTC transceivers intact with zero RTP network usage while out of range.
- Consolidate Chromium WebRTC audio sink handling into a single persistent muted sink to avoid Windows WASAPI audio device re-initialization hitches.
- Keep the existing Web Audio graph intact when a peer is paused/resumed, muting or zeroing gain rather than rebuilding nodes.
- Throttle peer state dispatches to the React UI to eliminate main-thread frame drops.

**Non-Goals:**
- Replacing Mediasoup or rewriting the WebRTC transport infrastructure.
- Altering the Minecraft Paper/Velocity plugin telemetry protocol or Bukkit API.
- Changing fixed channel feature behavior or administrative portal operations.

## Decisions

### 1. Structural Routing Isolation in `ClientGateway.ts`
- **Decision**: Split `startProximityLoop()` into mutually exclusive branches:
  ```ts
  if (channel === 'proximity') {
    // Proximity 3D Audio Routing & Distance Pausing
  } else {
    // Fixed Channel Audio Routing
  }
  ```
- **Rationale**: A player is either in dynamic 3D proximity chat or in an unspatialized fixed channel (e.g. Radio, Global, Staff). They cannot be in both simultaneously.
- **Alternatives Considered**: Adding an explicit `if (channel !== 'proximity')` check inside the loop. While functional, structural `if / else` makes the mutual exclusion physically unbreachable and clearer to maintain.

### 2. Mediasoup Consumer Pause/Resume for Distance Culling
- **Decision**: In `ClientGateway.ts`, track consumer pause state per peer. When a player moves beyond audible range or is in a different dimension/server:
  - Call `await consumer.pause()` instead of `consumer.close()`.
  - When the player returns within audible range, call `await consumer.resume()`.
  - Only call `consumer.close()` when a player disconnects, leaves the server, or switches to a different channel.
- **Rationale**: Mediasoup's C++ worker immediately stops transmitting RTP packets to the client when paused, reducing network traffic to zero blocks. Crucially, the WebRTC transceiver and RTP parameters remain negotiated in the browser, completely eliminating SDP renegotiation overhead and audio thread stutter.
- **Alternatives Considered**: Keeping consumer destroy/create with a debounce timer. This still causes freezes whenever players cross the boundary; pause/resume is the canonical SFU design pattern.

### 3. Single Persistent Muted Audio Sink in `SpatialAudioPipeline.ts`
- **Decision**: Initialize a single hidden `<audio>` element once when `SpatialAudioPipeline` is constructed or when the first track arrives. Set `audioEl.muted = true` or `volume = 0.0001` and attach a persistent `MediaStream`. When remote tracks arrive, add them to this persistent stream.
- **Rationale**: Chromium requires remote WebRTC tracks to be bound to an active HTMLMediaElement to prevent the WebRTC decoding engine from suspending audio rendering before it hits Web Audio's `createMediaStreamSource`. Creating and tearing down individual `<audio>` elements per peer triggers Windows WASAPI audio device allocation/deallocation in the OS audio server, causing micro-freezes. A single persistent sink keeps the decoder warm with zero OS churn.
- **Alternatives Considered**: Keeping per-peer `<audio>` elements. This was directly contributing to audio stutter on Windows.

### 4. Retain Web Audio Node Graphs for Paused Peers
- **Decision**: In `SpatialAudioPipeline.ts`, when a peer is paused, do not call `disconnect()` on their `PannerNode`, `BiquadFilterNode`, or `GainNode`. Simply ramp their gain to zero.
- **Rationale**: Allocating a `PannerNode` with `panningModel = 'HRTF'` is computationally heavy and requires loading convolution kernels. Keeping the node instantiated in the pipeline eliminates memory churn and garbage collection spikes.

### 5. Throttled UI State Dispatch
- **Decision**: In `VoiceSignaling.ts`, batch `onPeersUpdated` callbacks using `requestAnimationFrame` or a 50ms throttle instead of invoking `setPeers` on every individual 100ms packet per peer.
- **Rationale**: With multiple players nearby, receiving 10–30 positional packets per second triggered continuous full-tree React re-renders in `PlayerRoute.tsx` (983 lines) and re-evaluations of SVG radar elements.

## Risks / Trade-offs

- **[Risk]** Paused consumers occupy memory on the SFU worker until disconnect.
  $\rightarrow$ **Mitigation**: Audio consumers in Mediasoup have a negligible memory footprint (~few kilobytes). When a client disconnects or changes channel, `cleanupSession()` explicitly calls `consumer.close()`.
- **[Risk]** Chromium auto-play policy on the single persistent audio sink.
  $\rightarrow$ **Mitigation**: The sink is initialized inside the user-gesture click handler (`handleConnect()`) and kept muted (`audioEl.muted = true`), which complies with all browser autoplay restrictions.
