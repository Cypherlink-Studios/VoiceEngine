## Why

The Paper plugin currently uses a monolithic structure where `VoiceEnginePlugin` directly manages configuration, schedulers, networking, and commands with hardcoded English strings and legacy Bukkit `CommandExecutor`. Migrating to Incendo Cloud v2 with annotation-based commands, establishing an extensible service lifecycle with a public API and Bukkit events, and introducing a per-player translation system (i18n) with server fallback elevates the plugin to production-grade standards and prepares the foundation for future extensions and frontend localization.

## What Changes

- **Command Architecture (Incendo Cloud v2)**:
  - Replace Bukkit `CommandExecutor` with Incendo Cloud v2 (`cloud-paper` & `cloud-annotations`).
  - Introduce annotation-driven command definitions (`@Command`, `@Permission`).
  - Add `/voice reload` to hot-reload configuration and language bundles without restarting the server.
  - Add `/voice status` to inspect backend connectivity, latency, and active sessions.
  - Integrate native Brigadier auto-completion, argument validation, and rich exception handlers.
  - Relocate Cloud libraries into `com.voiceengine.libs.cloud` to prevent runtime classpath conflicts on Paper servers.
- **Extensible Architecture & Public API**:
  - Decouple `VoiceEnginePlugin` into discrete services (`ConfigService`, `TranslationService`, `CommandService`, `TelemetryService`, `VisualFeedbackService`).
  - Introduce typed configuration objects (`VoiceConfig`) with reload capabilities.
  - Expose a public developer API (`VoiceEngineAPI`) via Bukkit's `ServicesManager` and `VoiceEngine.getApi()`.
  - Dispatch custom Paper events (`PlayerVoiceConnectedEvent`, `PlayerVoiceDisconnectedEvent`, `PlayerSpeakingStateChangeEvent`) for third-party plugin integrations.
- **Per-Player Translation System (i18n)**:
  - Implement `TranslationService` supporting per-player locale resolution (`player.locale()`) with server default fallback.
  - Store externalized language files in `lang/messages_en_US.yml` and `lang/messages_es_ES.yml` using Adventure `MiniMessage` formatting (gradient, colors, hover, and click events).
  - Define a hierarchical message key taxonomy compatible with future Web Client localization.

## Capabilities

### New Capabilities
*(None - all additions enhance the core bridge plugin capability)*

### Modified Capabilities
- `paper-voice-bridge`: Modernize command dispatch with Cloud v2, provide multi-locale per-player messaging with MiniMessage, and expose public API and custom events for third-party integrations.

## Impact

- **Paper Plugin Source Code**:
  - `build.gradle.kts`: Add `org.incendo:cloud-paper:2.0.0`, `org.incendo:cloud-annotations:2.0.0`, and shadow relocation.
  - `src/main/resources/plugin.yml`: Remove legacy commands block (Cloud v2 registers commands dynamically via Brigadier).
  - `src/main/resources/lang/`: Add `messages_en_US.yml` and `messages_es_ES.yml`.
  - Refactor `VoiceEnginePlugin` into modular service containers and public API interfaces.
- **Third-Party Plugins**:
  - Gain access to `VoiceEngineAPI` and custom Bukkit events.
- **Player & Admin Experience**:
  - Localized chat feedback matching client language settings.
  - Tab completion and syntax hints in Minecraft 1.21 chat box.
  - Instant config/locale reloading via `/voice reload`.
