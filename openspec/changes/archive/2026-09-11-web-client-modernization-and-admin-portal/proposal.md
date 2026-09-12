## Why

The current web client features a basic UI without visual identity customization, routing, or non-proximity communication channels. Server administrators need a modern, branded experience for their Minecraft players, an intuitive admin portal (`/admin`) authenticated directly from in-game admin ranks, and global Discord-style fixed channels (such as Lobby or Staff) alongside spatial 3D proximity chat.

## What Changes

- **Modern Glassmorphism UI & Visualizer**: Complete visual redesign of the web client with reactive audio wave visualizer, Minecraft head avatars on the 3D radar, and a sleek control dock.
- **Client Clean Routing**: Introduction of client-side routing (`/` for player voice, `/admin` for the administrator dashboard).
- **Admin Portal (`/admin`)**:
  - Live Branding Customizer: Dynamic color themes (CSS variables), server name, logo, background wallpapers, and welcome message with instant live preview.
  - Fixed Channels Management: Create, edit, and delete Discord-style global voice rooms (unattenuated stereo audio) with user limits.
  - Runtime Backend Settings: Tune slot limits, max voice distance, sneak distance, and audio bitrates without server restarts.
  - Live SFU & Player Monitor: Real-time connected players, channel assignments, and transport metrics.
- **In-Game `/voice admin` Authentication**: Subcommand `/voice admin` in Paper plugin requiring `voiceengine.admin` permission, generating short-lived administrative tokens to securely access `/admin`.
- **Backend Persistent Settings & Discord-Style Routing**:
  - Persistent storage in `voice-server/data/settings.json`.
  - Public configuration endpoint `GET /api/config/public` for dynamic brand styling on client load.
  - Protected admin REST API (`/api/admin/auth`, `/api/admin/settings`, `/api/admin/metrics`).
  - Selective audio subscription in Mediasoup SFU for fixed channel participants (stereo unspatialized routing).

## Capabilities

### New Capabilities
- `admin-portal-and-customization`: Admin web portal (`/admin`), dynamic visual branding customization, persistent settings storage, and runtime backend configuration.

### Modified Capabilities
- `web-client-spatial-audio`: Modern glassmorphism design, reactive audio waveforms, Minecraft avatar skin renders, clean routing, and audio switching between 3D proximity and fixed Discord-style channels.
- `voice-backend-sfu`: Discord-style fixed channel audio routing (global unspatialized stereo), admin token authentication, settings persistence, and admin API endpoints.
- `paper-voice-bridge`: Subcommand `/voice admin` with `voiceengine.admin` permission enforcement and admin token generation.

## Impact

- **Web Client**: Adds `react-router-dom` dependency; refactors `App.tsx` into routed components (`PlayerRoute`, `AdminRoute`), with modular audio visualizers and channel drawers.
- **Voice Server**: Adds JSON file persistence for settings, admin authentication middleware, new Express REST endpoints (`/api/config/public`, `/api/admin/*`), and channel-aware consumer mapping in `ClientGateway` / `MediasoupManager`.
- **Paper Plugin**: Extends `VoiceCommand.java` to support `admin` argument with permission validation, and updates `plugin.yml` with `voiceengine.admin` permission node.
