# Tasks

## 1. Voice Server Protocol & Bidirectional Sync (`voice-server`)

- [x] 1.1 Extend `SessionTokenRecord` and `ClientSession` in `voice-server/src/types.ts` and `TokenStore.ts` to store `streamerMode?: boolean` and `streamerModeExplicit?: boolean`, and update `PluginGateway.ts` `register_token` parsing to preserve them; verify with `TokenStore.test.ts` and `PluginGateway.test.ts`.
- [x] 1.2 Update `ClientGateway.ts` (`client_auth` -> `auth_success`) and `voice-server/src/routes/api.ts` (`/api/admin/auth`) to resolve initial `streamerMode` (preferring `streamerModeExplicit` from Minecraft, otherwise adopting `clientStreamerMode: true` and emitting `streamer_mode_sync` back to the plugin) and include `streamerMode` in auth responses; verify with `ClientGateway.test.ts` and `ApiRoutes.test.ts`.
- [x] 1.3 Implement live bidirectional relay in `PluginGateway.ts` and `ClientGateway.ts` for `streamer_mode_sync` (Plugin -> active WebSocket `streamer_mode_changed`) and `streamer_mode_update` (Web client -> authoritative Velocity or `serverId` Paper socket `streamer_mode_sync`), adding unit/integration assertions in `voice-server/test/ClientGateway.test.ts` and `voice-server/test/PluginGateway.test.ts` and running `npm test` in `voice-server/`.

## 2. Paper Plugin Preferences, Commands & Zero-Leak Prompts (`paper-plugin`)

- [x] 2.1 Implement `PlayerPreferencesManager` persisting per-UUID `streamerMode` and `updatedAt` in `plugins/VoiceEngine/player-preferences.yml` with unit tests verifying load, save, explicit-flag lookup, and thread-safe updates.
- [x] 2.2 Add `voiceengine.streamer` (`default: true`) in `paper-plugin/src/main/resources/plugin.yml`, add `command.streamer.*`, zero-leak `command.connect.prompt_streamer`, `command.admin.prompt_streamer`, masked `command.room.created_streamer` / `joined_streamer`, and `notification.join_streamer` keys to `messages_en_US.yml` and `messages_es_ES.yml`, and verify bundle loading via `TranslationServiceTest`.
- [x] 2.3 Update `VoiceCommands.java` and `RoomCommands.java` with `/voice streamer [on|off|status]`, zero-leak `[Open Web]` / `[Copy Code]` / `[Copy Link]` prompts, masked room PIN messages, and `streamerMode`/`streamerModeExplicit` inclusion in `register_token`; verify with `VoiceCommandsTest` and `RoomCommandsTest`.
- [x] 2.4 Update `VoiceBackendClient.java` and `VoiceEnginePlugin.java` to send and handle `streamer_mode_sync` frames (persisting updates from web client into `player-preferences.yml`) and render Streamer-aware join notifications; verify with `VoiceBackendClientTest` and run `./gradlew test` in `paper-plugin/`.

## 3. Velocity Proxy Preferences & Network Zero-Leak Prompts (`velocity-plugin`)

- [x] 3.1 Extend `ModerationDatabase.java` with a `player_preferences (player_uuid, streamer_mode, updated_at)` SQLite table and CRUD methods (`getStreamerMode`, `hasExplicitPreference`, `setStreamerMode`), verifying with tests in `ModerationDatabaseTest`.
- [x] 3.2 Update `VelocityBackendClient.java` to include `streamerMode` and `streamerModeExplicit` in `register_token` and dispatch/receive `streamer_mode_sync` frames back to `ModerationDatabase`.
- [x] 3.3 Update `VelocityVoiceCommands.java` (`@Command("voice-velocity|ve-velocity|voiceengine-velocity|audio-velocity streamer ...")` + zero-leak `/voice-velocity` and `/voice-velocity admin` prompts) and `ServerPostConnectListener.java` (Streamer Mode join notice), and run `./gradlew test` in `velocity-plugin/` to confirm all proxy tests pass.

## 4. Web Client URL Sanitization, Masked Inputs & Live Sync (`web-client`)

- [x] 4.1 Update `VoiceSignaling.ts` (`client_auth` with `clientStreamerMode`, `onAuthenticated` player `streamerMode`, `onStreamerModeChanged` callback, and `sendStreamerModeUpdate(enabled)` method) and `web-client/src/i18n/locales/{en,es}.ts` for masked login/room labels.
- [x] 4.2 Update `PlayerRoute.tsx` and `AdminRoute.tsx` to immediately strip `?token=` / `?code=` via `window.history.replaceState` on mount/search-param detection, mask token inputs (`type="password"`) with an explicit reveal/hide eye button, and apply incoming `streamerMode` / emit `streamer_mode_update` on `SettingsModal` toggle.
- [x] 4.3 Mask active temporary room PINs (`Room #••••••`) and join-room PIN inputs in `PlayerRoute.tsx` and `ChannelDrawer.tsx` when `streamerMode` is active while keeping copy-PIN and explicit reveal toggle functional; verify with `npm run build` / `tsc --noEmit` in `web-client/`.

## 5. Cross-Module Verification & Documentation Sync

- [x] 5.1 Run full test and build suites across `voice-server` (`npm test`), `paper-plugin` (`./gradlew test`), `velocity-plugin` (`./gradlew test`), and `web-client` (`npm run build`) and verify zero regressions.
- [x] 5.2 Update command and privacy documentation in `docs/en/` and `docs/es/` (`commands-and-permissions.md`, `moderation-and-security.md`) to document `/voice streamer` and Zero-Leak Streamer Mode, verifying links and formatting.
