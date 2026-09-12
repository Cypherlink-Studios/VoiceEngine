## 1. Build and Dependency Configuration

- [x] 1.1 Add Incendo Cloud v2 dependencies (`org.incendo:cloud-paper:2.0.0` and `org.incendo:cloud-annotations:2.0.0`) to `paper-plugin/build.gradle.kts` and verify `./gradlew dependencies` resolves cleanly.
- [x] 1.2 Configure Gradle ShadowJar relocation for `org.incendo.cloud` to `com.voiceengine.libs.cloud` in `build.gradle.kts` and verify shadowJar task builds without errors.

## 2. Translation and Localization (i18n)

- [x] 2.1 Create base language bundles `paper-plugin/src/main/resources/lang/messages_en_US.yml` and `messages_es_ES.yml` with MiniMessage markup for command prompts, errors, notifications, and status diagnostics.
- [x] 2.2 Implement `TranslationService` to extract bundled language files, resolve per-player locales (`player.locale()`) with default fallback, and render Adventure MiniMessage components with dynamic placeholders; verify with unit tests in `TranslationServiceTest`.

## 3. Modular Architecture and Service Lifecycle

- [x] 3.1 Implement typed immutable configuration records (`VoiceConfig`) with validation and default fallback in `com.voiceengine.config`.
- [x] 3.2 Define the `VoiceEngineService` lifecycle interface (`start()`, `stop()`, `reload()`) and decompose background operations into `TelemetryService` and `VisualFeedbackService`.
- [x] 3.3 Create public API interfaces and custom Bukkit events (`VoiceEngineAPI`, `PlayerSpeakingStateChangeEvent`, `PlayerVoiceConnectedEvent`, `PlayerVoiceDisconnectedEvent`) and register with Bukkit `ServicesManager`.

## 4. Command Migration to Incendo Cloud v2

- [x] 4.1 Implement `CommandService` initializing `PaperCommandManager` with `ExecutionCoordinator.simpleCoordinator()`, custom exception handlers for permission and syntax errors formatted via `TranslationService`, and register the annotation parser.
- [x] 4.2 Create annotated command class `VoiceCommands` declaring `/voice`, `/voice admin`, `/voice reload`, and `/voice status` with appropriate `@Permission` checks and argument bindings.
- [x] 4.3 Update `src/main/resources/plugin.yml` to remove the legacy Bukkit `commands` declaration while preserving permissions.

## 5. Plugin Refactor, Integration, and Verification

- [x] 5.1 Refactor `VoiceEnginePlugin` to orchestrate service lifecycle, register events, expose `VoiceEngineAPI`, and wire reload execution cleanly.
- [x] 5.2 Update and expand unit test suites in `paper-plugin/src/test/java` to test command routing, token generation, and translation fallbacks; verify with `./gradlew test`.
- [x] 5.3 Build the final plugin with `./gradlew build` and verify the shaded jar structure, manifest, and relocated packages.
