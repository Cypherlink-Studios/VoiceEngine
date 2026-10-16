# Design: Disable Player Radar per Server

## Context

See `proposal.md` for background and motivation. Currently:
- The Paper Minecraft plugin streams player telemetry batches (`SpatialTelemetryBatch`) over WebSocket to `voice-server`.
- `voice-server` runs `SpatialEngine.ts` to evaluate audible peers and dispatches `peer_spatial_update` (or binary spatial batches) to connected web clients.
- `web-client` feeds these relative coordinates into `SpatialAudioPipeline.ts` (Web Audio API `PannerNode` for 3D HRTF panning) and populates the `peers` state rendered inside `<Radar.tsx>` on the central stage and `<PipOverlay.tsx>` in Document Picture-in-Picture.

This design introduces a server-level configuration toggle to conditionally disable the visual radar UI while keeping the underlying 3D spatial audio pipeline 100% intact.

## Goals / Non-Goals

**Goals:**
- Provide a clean, hot-reloadable configuration toggle in Paper (`mechanics.radar-enabled: true/false`).
- Transmit server radar policy to `voice-server` via `SpatialTelemetryBatch`.
- Deliver event-driven `radar_status` notifications to the web client upon connection and server transitions.
- Render a dedicated `<ProximityRoster />` (Option B) with player avatars, speaking pulse indicators, local mute toggles, and individual volume sliders when radar is disabled.
- Support Document Picture-in-Picture fallback showing a compact roster of speaking peers.
- Preserve 3D binaural directional audio and distance attenuation without modification.

**Non-Goals:**
- Removing or altering the Web Audio API's `PannerNode` or HRTF distance models.
- Changing fixed Discord-style channels.
- Server-side audio mixing or transcoding (Mediasoup SFU continues forwarding raw Opus RTP packets).

## Decisions

### 1. Telemetry State Transmission in Paper Plugin
- **Decision**: Add `radarEnabled` (boolean) to `SpatialTelemetryBatch.java` alongside `spectatorMode`. Default to `true`.
- **Rationale**: `SpatialTelemetryBatch` already serves as the authoritative, periodic state envelope between Paper and `voice-server`. Adding `radarEnabled` requires no new socket connections or side channels.
- **Alternative considered**: Sending a separate custom packet on reload. Rejected because periodic batch sync guarantees consistency if the backend restarts or reconnects.

### 2. Backend Server State Mapping & Client Dispatch
- **Decision**: `PluginGateway` and `SpatialEngine` store `radarEnabled` mapped by `serverId`. In `ClientGateway`:
  1. During client authentication (`auth_success`), send the initial `radar_status` based on the listener's server.
  2. In the proximity loop, if `listenerPlayer.serverId` transitions or server radar status changes, dispatch:
     ```json
     {
       "type": "radar_status",
       "enabled": false
     }
     ```
- **Rationale**: Event-driven notification avoids bandwidth overhead while responding immediately to server hops (e.g. Lobby -> Survival).

### 3. Frontend Proximity Roster Component (`<ProximityRoster />`)
- **Decision**: Create a dedicated `<ProximityRoster />` component styled in frosted glass to replace `<Radar />` when `radarEnabled === false`.
- **UI Architecture**:
  - Displays a grid/list of players within hearing range.
  - Each item shows:
    - Minecraft avatar head (`https://mc-heads.net/avatar/{uuid}/64`).
    - Player username and submerged badge if underwater.
    - Animated green audio pulse ring around avatar when speaking.
    - Per-user volume slider (0% to 200%) and local mute button.
  - When no peers are in range, displays a friendly empty state ("No players nearby").
- **Alternative considered**: Hiding the radar dish completely with an empty circle. Rejected because players would lose the ability to balance individual volume levels and see who is speaking.

### 4. Document Picture-in-Picture Fallback
- **Decision**: In `PipOverlay.tsx`, conditionally render a vertical mini-roster instead of the 210px radar disk when `radarEnabled` is `false`.
- **Rationale**: Keeps PiP functional and informative without displaying forbidden tactical coordinates.

## Risks / Trade-offs

- **[Risk: Multi-server hopping latency]** → *Mitigation*: `SpatialEngine` updates `serverId` immediately upon telemetry intake; `ClientGateway` detects changes during the next 100ms proximity loop cycle and dispatches `radar_status`.
- **[Risk: Backward compatibility with un-updated Paper plugins]** → *Mitigation*: If `radarEnabled` is missing or undefined in `telemetry_batch`, the backend defaults to `true`.
- **[Risk: Stale volume preferences]** → *Mitigation*: `<ProximityRoster />` uses the same `peerVolumes` state and `onVolumeChange` callbacks as `<Radar />` and `SettingsModal.tsx`.

## Migration Plan

1. Deploy `voice-server` backend update (supports new `telemetry_batch` property and client `radar_status` frame).
2. Deploy `paper-plugin` update (adds `mechanics.radar-enabled` to `config.yml`).
3. Deploy `web-client` update (renders `<ProximityRoster />` when `radar_status` is false).
4. No database or configuration schema migrations required.
