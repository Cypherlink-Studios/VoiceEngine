## Context

The existing Paper plugin (`paper-plugin`) operates on Paper 1.21.4 with Java 21+ toolchain and Shadow 8.3.6. It currently uses Bukkit's legacy `CommandExecutor` registered via `plugin.yml`, hardcoded English Adventure components, and manages all networking, token handling, and Bukkit tasks inside `VoiceEnginePlugin.java`.

See `proposal.md` for motivation and high-level scope.
See `specs/paper-voice-bridge/spec.md` for formal requirement contracts.

## Goals / Non-Goals

**Goals:**
- Migrate command handling to Incendo Cloud v2 using declarative annotations (`cloud-annotations`) and native Brigadier integration on Paper 1.21.4.
- Implement a per-player localized message service (`TranslationService`) using Adventure `MiniMessage` and external YAML resource bundles (`en_US`, `es_ES`) with server fallback.
- Introduce hot-reloading (`/voice reload`) and diagnostics (`/voice status`) without dropping active player sessions.
- Deconstruct the monolithic `VoiceEnginePlugin` into cleanly isolated services adhering to a unified lifecycle (`start()`, `stop()`, `reload()`).
- Expose a public developer API (`VoiceEngineAPI`) and custom Bukkit events (`PlayerSpeakingStateChangeEvent`, `PlayerVoiceConnectedEvent`).
- Shadow and relocate Incendo Cloud classes to `com.voiceengine.libs.cloud` to eliminate runtime classpath conflicts.

**Non-Goals:**
- Frontend Web Client localization implementation (this change establishes the shared taxonomy and backend foundation; Web Client UI localization is handled in a separate change).
- Multi-server BungeeCord / Velocity proxy messaging (currently scoped to Paper server bridge).
- Database persistence for tokens (tokens remain short-lived, in-memory TTL records).

## Decisions

### 1. Incendo Cloud v2 with Annotations (`cloud-paper` & `cloud-annotations`)
- **Choice**: Use `org.incendo:cloud-paper:2.0.0` with `org.incendo:cloud-annotations:2.0.0` and `ExecutionCoordinator.simpleCoordinator()`.
- **Rationale**: Paper 1.21.4 introduces modern lifecycle command registration directly integrated with vanilla Brigadier. Annotations (`@Command`, `@Permission`) provide clean, declarative subcommands (`/voice`, `/voice admin`, `/voice reload`, `/voice status`) and reduce boilerplate while automatically generating tab-completions and parameter validation.
- **Alternatives Considered**:
  - *Cloud v2 Builder DSL*: Verbose and spreads routing logic across large procedural setup methods.
  - *Commodore / Paper 1.21 Native Lifecycle Events*: Lower level, requiring manual tab completion, permission checking, and syntax exception formatting.

### 2. Dependency Relocation via ShadowJar
- **Choice**: Relocate `org.incendo.cloud` to `com.voiceengine.libs.cloud`.
- **Rationale**: Cloud is widely adopted among modern Paper plugins. Relocating shades our specific version and prevents runtime binary incompatibility when coexisting with other plugins on the same server.

### 3. Per-Player Localization with Adventure MiniMessage and YAML Bundles
- **Choice**: Externalized YAML language files stored in `lang/messages_<locale>.yml`, resolved dynamically via `player.locale()`, with fallback to the configured server default locale (`en_US`), parsed through `MiniMessage`.
- **Rationale**: Adventure MiniMessage supports modern rich formatting (gradients, `<click:open_url>`, `<hover:show_text>`) without fragile legacy formatting codes. Server admins are comfortable editing YAML files in `plugins/VoiceEngine/lang/`.
- **Alternatives Considered**:
  - *Java ResourceBundle (.properties)*: Less friendly for multiline rich formatting and UTF-8 encoding compared to YAML.
  - *Server-wide single language*: Inconvenient for international communities where players prefer UI prompts in their native Minecraft client language.

### 4. Modular Service Lifecycle & Public API
- **Choice**: Encapsulate functionality into dedicated service classes governed by a common lifecycle interface:
  - `ConfigService`: Typed immutable configuration (`VoiceConfig`).
  - `TranslationService`: Language loading, locale lookup, and MiniMessage formatting.
  - `BackendClientService`: Manages `VoiceBackendClient` lifecycle, reconnections, and token transmission.
  - `TelemetryService`: Async player coordinate collection.
  - `VisualFeedbackService`: Main-thread particle feedback.
  - `CommandService`: Cloud v2 initialization, annotation parsing, and exception handling.
  - `VoiceEngineAPI`: Interface registered with Bukkit's `ServicesManager` and accessible via `VoiceEngine.getApi()`.
- **Rationale**: Decouples logic from the `JavaPlugin` class, allows isolated unit testing, and permits individual services (like config and translations) to reload safely.

## Risks / Trade-offs

- **[Risk]** Cloud v2 Paper command registration lifecycle changes between Paper versions.
  - **Mitigation**: Use `PaperCommandManager.builderCoordinator(ExecutionCoordinator.simpleCoordinator()).buildOnEnable(plugin)` which is officially supported for Paper 1.20.6+ and 1.21.4.
- **[Risk]** Missing or malformed keys in custom YAML translations could crash message dispatch.
  - **Mitigation**: The `TranslationService` will implement a two-stage fallback: player locale → default server locale → hardcoded English emergency string, logging a warning rather than throwing exceptions.
- **[Risk]** ShadowJar jar bloat.
  - **Mitigation**: Cloud v2 paper and annotations add only minimal footprint (~300KB), well within typical Minecraft plugin expectations.
