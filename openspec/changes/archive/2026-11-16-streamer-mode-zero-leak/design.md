# Design: Zero-Leak Streamer Mode

## Context

See `proposal.md` for motivation and affected capabilities.

Currently, `web-client` maintains a client-local `streamerMode` boolean (`voiceengine:streamer_mode` in `localStorage`) that masks usernames, coordinates, and the QR modal after connection, while `paper-plugin` and `velocity-plugin` output plaintext tokens/URLs in chat (`/voice`, `/voice admin`, `/voice-velocity`) and room PINs (`/voice room create`/`join`). Additionally, `PlayerRoute` and `AdminRoute` leave `?token=` in the address bar on `/` and render token inputs as plaintext `<input type="text">`.

Constraints:
- Paper runs either standalone (handling `/voice`, `/voice room`, and join notifications) or in `proxy-mode: true` behind Velocity (delegating `/voice` and join notices to Velocity).
- `voice-server` connects concurrently to one optional `velocity` socket and one or more `paper` sockets keyed by `serverId` (`PluginGateway`), and already uses an analogous per-player boolean sync pattern (`staff_vanish_sync`).

## Goals / Non-Goals

**Goals:**
- Prevent any single-use connection token, tokenized URL, or private room PIN from appearing in Minecraft chat, Minecraft's native "Open URL" modal, browser address bars, or unmasked login/room inputs when Streamer Mode is enabled.
- Persist Streamer Mode preferences per player UUID (`plugins/VoiceEngine/player-preferences.yml` in Paper, SQLite `player_preferences` table in Velocity) so protection applies automatically on join and on `/voice`.
- Synchronize Streamer Mode bidirectionally in real time between Minecraft and the web client (`register_token` -> `auth_success`, `streamer_mode_sync`, `streamer_mode_update`, `streamer_mode_changed`).

**Non-Goals:**
- Obscuring `/voice room join <pin>` characters while the user is actively typing the command into their own Minecraft chat bar (Minecraft client behavior outside plugin control; streamers can join via the masked web client input instead).
- Replacing single-use IP-bound tokens with OAuth or external identity providers.
- Hiding in-game Minecraft world coordinates on the player's own F3 debug screen or HUD mods.

## Decisions

### 1. Clipboard-First Zero-Leak Chat Prompt + Clean Base URL
- **Decision**: When Streamer Mode is enabled, `/voice`, `/voice admin`, and their Velocity equivalents render three MiniMessage actions:
  1. `[Open Web]` / `[Open Panel]` -> `<click:open_url:'<cleanBaseUrl>'>` (no `?token=` query string).
  2. `[Copy Code]` -> `<click:copy_to_clipboard:'<token>'>`
  3. `[Copy Link]` -> `<click:copy_to_clipboard:'<tokenizedUrl>'>`
- **Rationale**: In Minecraft, clicking `open_url` triggers the client's native "Are you sure you want to open the following website?" modal displaying the full URL in large text—unless the player explicitly disabled link prompts in Minecraft settings. Using a clean URL for `open_url` plus `copy_to_clipboard` guarantees zero screen leaks regardless of Minecraft client settings.
- **Alternative Considered**: Simply hiding the code in chat text while keeping `<click:open_url:'<tokenizedUrl>'>`. Rejected because the native Minecraft confirmation modal still exposes `?token=...` on stream.

### 2. Per-Plugin Persistent Storage (`player-preferences.yml` in Paper, SQLite in Velocity)
- **Decision**:
  - **Paper**: Store preferences in `plugins/VoiceEngine/player-preferences.yml` via a dedicated `PlayerPreferencesManager` (following the `SpeakerManager` / `AudioManager` YAML pattern) keyed by UUID with `streamerMode: boolean` and `updatedAt: long`.
  - **Velocity**: Add a `player_preferences (player_uuid TEXT PRIMARY KEY, streamer_mode INTEGER NOT NULL, updated_at INTEGER NOT NULL)` table to `ModerationDatabase`'s existing SQLite database.
- **Rationale**: User explicitly chose `player-preferences.yml` for Paper consistency and admin inspectability, while Velocity already initializes SQLite via `ModerationDatabase` for network-wide player state.
- **Alternative Considered**: Paper `PersistentDataContainer` (PDC). Rejected in favor of `player-preferences.yml` so offline updates from `streamer_mode_sync` and file inspection work uniformly without loading offline player `.dat` files.

### 3. Bidirectional Sync & First-Connection Precedence
- **Decision**:
  - `register_token` includes `streamerMode: boolean` and `streamerModeExplicit: boolean` (true if UUID has a saved entry in `player-preferences.yml` / SQLite).
  - `client_auth` includes `clientStreamerMode?: boolean` read from `localStorage` (`voiceengine:streamer_mode === 'true'`).
  - Precedence on `client_auth`:
    1. If `streamerModeExplicit` is true on the token record, Minecraft's value wins and is returned in `auth_success.streamerMode`.
    2. Otherwise, if `clientStreamerMode === true`, the backend adopts `true`, returns `streamerMode: true` in `auth_success`, and dispatches `streamer_mode_sync` (`enabled: true`) to the authoritative plugin socket so Minecraft persists it.
    3. Otherwise `false`.
  - Live updates while connected:
    - Web toggle (`SettingsModal`) -> `VoiceSignaling` sends `streamer_mode_update { enabled }` -> `ClientGateway` -> `PluginGateway` sends `streamer_mode_sync { playerUuid, enabled }` -> Plugin persists to YAML/SQLite.
    - In-game `/voice streamer` -> Plugin persists to YAML/SQLite and sends `streamer_mode_sync { playerUuid, enabled }` -> `PluginGateway` -> `ClientGateway` sends `streamer_mode_changed { enabled }` to active web session -> `PlayerRoute` updates React state and `localStorage`.
- **Rationale**: Prevents resetting an existing streamer's browser `localStorage` preference to `false` on their first `/voice` after upgrade, while keeping both sides converged thereafter.
- **Alternative Considered**: Storing player preferences inside `voice-server` as the sole database. Rejected because Paper/Velocity need offline-resilient local access to render `/voice` prompts even before a web session exists or across restarts.

### 4. Authoritative Plugin Routing in Multi-Server Topologies
- **Decision**: When `PluginGateway` relays a `streamer_mode_sync` update from `ClientGateway` back to Minecraft:
  - If `velocitySocket` is open, send to Velocity (authoritative for `/voice-velocity` and network join notices).
  - Also (or otherwise) send to the session's `serverId` Paper socket (`paperSockets.get(serverId)`), or broadcast to Paper sockets if `serverId` is `'default'` / unknown.
  - Paper ignores `/voice` registration in `proxy-mode: true`, but still owns `/voice room` when standalone; syncing to Velocity when present and Paper when standalone (or `RoomCommands` checks local `PlayerPreferencesManager`) keeps both consistent.
- **Rationale**: Mirrors how `PluginGateway` routes `player_quit` / `speech_status` across standalone Paper and Velocity proxy deployments.
- **Alternative Considered**: Only sending to `paperSockets`. Rejected because in Velocity proxy setups Paper suppresses `/voice` and Velocity owns token dispatch.

### 5. Pre-Auth URL Sanitization & Masked Inputs in Web Client
- **Decision**:
  - In `PlayerRoute` and `AdminRoute`, read `token` / `code` from `window.location.search` / `searchParams` and immediately execute `window.history.replaceState(null, '', window.location.pathname)` before connection completes.
  - Render token inputs as `type={showToken ? 'text' : 'password'}` where `showToken` defaults to `false` whenever `streamerMode` is `true` OR when a token was auto-populated from URL parameters (`?token=` / `?code=`), with an explicit eye icon button to toggle visibility.
  - Mask active room PINs in `PlayerRoute` (`Room #••••••`) and `ChannelDrawer` (with existing copy-PIN button and optional eye toggle), and mask the join-room PIN input when `streamerMode` is `true`.
- **Rationale**: Protects the streamer even before `auth_success` arrives—specifically when opening a copied link or pasting a code on stream before connecting.

## Risks / Trade-offs

- **[Risk] Clipboard Hijack / Accidental Paste on Stream** → Mitigation: Users paste into a `type="password"` masked input on `/` and `/admin` (or paste `?token=` URL directly into the browser bar where `history.replaceState` clears it immediately).
- **[Risk] Paper Behind Velocity Using `RoomCommands`** → Note: Currently `VoiceEnginePlugin` disables `VoiceCommands` and `RoomCommands` when `isProxyMode()` is true; if Paper ever handles room commands in proxy mode, `PluginGateway` syncing to both Velocity and Paper `serverId` ensures `PlayerPreferencesManager` stays warm if needed, while Velocity handles `/voice` and `/voice admin`.
- **[Risk] Concurrent Writes to `player-preferences.yml` in Paper** → Mitigation: Synchronize in-memory `ConcurrentHashMap<UUID, PlayerPreference>` with serialized/debounced or synchronized YAML saves on Bukkit async/plugin thread, matching `SpeakerManager` / `AudioManager` patterns.
- **[Risk] Stale `?token=` Flash Before React Effect Runs** → Mitigation: Perform `history.replaceState` synchronously inside the initial render/mount effect (or lazily in initial state setup) so the query parameter disappears within the first frame.
