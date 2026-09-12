## Context

The existing VoiceEngine architecture consists of a Paper Minecraft plugin streaming player positions and issuing connection tokens, an Express + Mediasoup SFU backend calculating Euclidean distances for 3D spatial audio, and a React + Tailwind CSS client rendering HRTF spatial audio with a simple radar.

This design introduces a modern visual upgrade, client-side routing, an administrative portal (`/admin`), Discord-style non-spatial fixed voice channels, and permission-backed administrative access via `/voice admin`.

See `proposal.md` for motivation and scope.

## Goals / Non-Goals

**Goals:**
- Provide clean client-side routing (`/` for player voice, `/admin` for the admin portal) using `react-router-dom`.
- Deliver a modern glassmorphism UI with reactive audio waveforms, Minecraft head skin renders on the radar, and a sleek control dock.
- Enable dual-mode audio: full 3D spatialized proximity chat OR Discord-style global stereo audio for fixed channels.
- Implement secure, passwordless admin authentication anchored in Minecraft permissions (`/voice admin` checks `voiceengine.admin`).
- Enable live visual branding customization with real-time preview and runtime backend configuration persisted in `data/settings.json`.

**Non-Goals:**
- Heavy external database dependencies (e.g., PostgreSQL/MySQL); file-based JSON storage suffices for VoiceEngine's configuration.
- Multi-channel concurrent listening (players are either in Proximity or in one active Fixed Channel).
- WebRTC video or screen-sharing capabilities.

## Decisions

### 1. Client Routing Architecture (`react-router-dom`)
- **Choice**: Implement standard declarative routing (`createBrowserRouter`) with two primary routes: `/` (`PlayerRoute`) and `/admin` (`AdminRoute`).
- **Rationale**: Isolates admin dashboard code and assets, enables clean URL handling, and supports deep-linking with authentication query tokens (`/admin?token=...`).
- **Alternatives Considered**: Single-page state switching with tabs (messy URL history, awkward state isolation).

### 2. Dual-Pipeline Audio Routing (Spatial vs Stereo Discord-Style)
- **Choice**: In `SpatialAudioPipeline.ts`, incoming consumer streams will have two routing pathways:
  - **Proximity Mode**: `MediaStreamTrack` -> `GainNode` -> `BiquadFilterNode` (underwater) -> `PannerNode` (HRTF 3D) -> `MasterGain` -> `destination`.
  - **Fixed Channel Mode**: `MediaStreamTrack` -> `GainNode` (level adjustment) -> `MasterGain` -> `destination` (bypassing 3D panner completely).
- **Rationale**: Channels like "Lobby" or "Staff" are intended to function like Discord voice rooms where players communicate clearly without spatial orientation or distance dropoff.
- **Alternatives Considered**: Positioning all players at the origin `(0, 0, 0)` in the 3D panner (still introduces HRTF coloration and unnecessary processing overhead).

### 3. In-Game Permission Token Authentication (`/voice admin`)
- **Choice**: Paper plugin checks `player.hasPermission("voiceengine.admin")` when `/voice admin` is executed, requests a token marked with `isAdmin: true` from the backend, and provides a clickable link to `/admin?token=...`. The backend validates the token, invalidates it against replay, and issues a signed administrative session token stored in memory/sessionStorage.
- **Rationale**: Eliminates the need for static passwords or complex external OAuth providers, directly honoring Minecraft staff rank hierarchies (LuckPerms/Vault).
- **Alternatives Considered**: Static master password in `.env` (less secure, prone to sharing/leakage, vulnerable to brute force).

### 4. Dynamic Theme Styling via CSS Variables
- **Choice**: Inject dynamic branding properties (`--brand-primary`, `--brand-accent`, `--brand-bg-image`) into `:root` via a `BrandProvider` component that fetches `/api/config/public`.
- **Rationale**: Allows instant real-time live preview in the admin panel as sliders and pickers are adjusted, requiring zero rebuilds of the frontend bundle.
- **Alternatives Considered**: Dynamic server-side CSS compilation or preset static CSS stylesheets.

### 5. Persistent File-Based Storage (`data/settings.json`)
- **Choice**: Store runtime settings, branding config, and fixed channel definitions in `voice-server/data/settings.json` with an atomic write helper and in-memory caching.
- **Rationale**: Portable, human-readable, easily backed up, and zero operational overhead.
- **Alternatives Considered**: SQLite / Redis (unnecessary operational complexity for single-node voice server settings).

## Risks / Trade-offs

- **[Risk] Audio bleed between Proximity and Fixed Channels**  
  → *Mitigation*: When a player switches from Proximity to a Fixed Channel, the client mutes or pauses all proximity consumers so that spatial voices do not interfere with channel communication.
- **[Risk] Admin token expiration before opening browser**  
  → *Mitigation*: Configure a 5-minute TTL on generated admin tokens, provide instant click feedback in Minecraft chat, and display an intuitive locked screen if expired.
- **[Risk] Broken image URLs in branding customization**  
  → *Mitigation*: Implement standard fallback gradients and default placeholder icons if custom logo or background URLs fail to load.
- **[Risk] Unauthenticated settings tampering**  
  → *Mitigation*: All `/api/admin/*` mutation endpoints require a valid administrative session token in the `Authorization: Bearer <token>` header.

## Migration Plan

1. Server startup automatically checks for `voice-server/data/settings.json`. If not found, it generates a default configuration populated from current environment variables.
2. The Paper plugin retains 100% backward compatibility for `/voice` while adding `/voice admin`.
3. The web client fallback continues to function seamlessly with default styling if `/api/config/public` is temporarily unreachable.
