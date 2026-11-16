# Proposal

## Why

While VoiceEngine's web client already masks player names, coordinates, and the companion QR code once connected, players streaming on platforms like OBS, Twitch, or YouTube still risk leaking their single-use connection codes, session URLs, and private room PINs in Minecraft chat, Minecraft's native "Open URL" confirmation dialog, the browser address bar, and the web login input field when initiating a session with `/voice`. Introducing a persistent, bidirectionally synchronized Zero-Leak Streamer Mode across Minecraft and the web client protects creators from session sniping and accidental credential exposure from the moment they join the server and request voice access.

## What Changes

- **Persistent In-Game Streamer Mode Toggle**:
  - Add `/voice streamer [on|off|status]` in `paper-plugin` (persisted per player UUID in `plugins/VoiceEngine/player-preferences.yml`) and `/voice-velocity streamer [on|off|status]` in `velocity-plugin` (persisted in SQLite `player_preferences`).
  - Indicate active Streamer Mode in join notifications without exposing sensitive details.
- **Zero-Leak In-Game Prompts (`/voice`, `/voice admin`, `/voice room`)**:
  - When a player has Streamer Mode enabled, replace plaintext token/URL chat output with interactive clipboard actions (`[Copy Code]`, `[Copy Link]` via MiniMessage `copy_to_clipboard`) and a clean `[Open Web]` / `[Open Panel]` link without `?token=` query parameters so Minecraft's native URL confirmation dialog cannot leak the code.
  - Mask private room PINs in `/voice room create` and `/voice room join` chat responses while preserving click-to-copy functionality.
- **Bidirectional Minecraft <-> Web Client Synchronization**:
  - Propagate `streamerMode` in `register_token`, `client_auth`, `auth_success`, and `/api/admin/auth`.
  - Relay live `streamer_mode_sync` (Plugin -> Backend -> Web Client) and `streamer_mode_update` (Web Client -> Backend -> Plugin) events so toggling Streamer Mode in either Minecraft or the web client settings immediately updates and persists both sides.
  - On first connection where Minecraft has no explicit preference stored for a UUID yet, adopt `true` if the web client already has `voiceengine:streamer_mode` enabled and persist it back to Minecraft.
- **Pre-Authentication & Room UI Protection in Web Client**:
  - Immediately strip `?token=` / `?code=` query parameters from the browser address bar via `window.history.replaceState` on `/` and `/admin`.
  - Mask token inputs (`type="password"` with a reveal/hide toggle) on both `PlayerRoute` and `AdminRoute` login cards.
  - Mask active temporary room PINs (`Room #••••••`) in `PlayerRoute` and `ChannelDrawer` when Streamer Mode is active.

## Capabilities

### New Capabilities
<!-- None; this extends existing plugin, proxy, backend, room, admin, and web-client capabilities. -->

### Modified Capabilities
- `paper-voice-bridge`: Add `/voice streamer` persistent preference (`player-preferences.yml`), zero-leak `/voice` and `/voice admin` chat prompts, join indicator, and bidirectional `streamer_mode_sync`.
- `velocity-voice-proxy`: Add `/voice-velocity streamer` persistent SQLite preference, zero-leak proxy prompts, join indicator, and bidirectional `streamer_mode_sync`.
- `voice-backend-sfu`: Propagate `streamerMode` in token registration and client authentication, resolve initial preferences, and relay live bidirectional `streamer_mode_sync` / `streamer_mode_update` frames.
- `temporary-private-rooms`: Mask 6-digit room PINs in chat output and web client room headers/drawers when Streamer Mode is active.
- `admin-portal-and-customization`: Sanitize `/admin` URL token parameters immediately upon reading, mask manual admin code input, and return `streamerMode` in admin auth responses.
- `web-client-spatial-audio`: Strip `?token=`/`?code=` immediately on load, mask login token input, mask room PINs, and synchronize `streamerMode` bidirectionally with Minecraft via `VoiceSignaling`.

## Impact

- **Paper Plugin (`paper-plugin`)**: `PlayerPreferencesManager`, `VoiceCommands`, `RoomCommands`, `VoiceBackendClient`, `VoiceEnginePlugin`, `plugin.yml`, `messages_en_US.yml`, `messages_es_ES.yml`.
- **Velocity Plugin (`velocity-plugin`)**: `ModerationDatabase` (new `player_preferences` table), `VelocityVoiceCommands`, `VelocityBackendClient`, `ServerPostConnectListener`, `VoiceEngineVelocityPlugin`.
- **Voice Server (`voice-server`)**: `types.ts`, `TokenStore.ts`, `PluginGateway.ts`, `ClientGateway.ts`, `routes/api.ts`.
- **Web Client (`web-client`)**: `PlayerRoute.tsx`, `AdminRoute.tsx`, `ChannelDrawer.tsx`, `VoiceSignaling.ts`, `i18n/locales/en.ts`, `i18n/locales/es.ts`.
