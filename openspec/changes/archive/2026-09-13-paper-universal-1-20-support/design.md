## Context

See `proposal.md` for motivation. Currently `paper-plugin` targets Java 21, uses `api-version: '1.21'`, and binds commands using `PaperCommandManager<CommandSourceStack>`. Paper 1.20.0 through 1.20.4 servers run on Java 17 and lack `io.papermc.paper.command.brigadier.CommandSourceStack`.

## Goals / Non-Goals

**Goals:**
- Produce a single universal `VoiceEngine-paper.jar` capable of running seamlessly on Paper 1.20.0 through 1.21.4.
- Target Java 17 bytecode so servers on Java 17 or Java 21 can load the plugin without `UnsupportedClassVersionError`.
- Decouple command declarations from Paper 1.20.6+ `CommandSourceStack` by migrating to `LegacyPaperCommandManager<CommandSender>`.
- Retain rich command features (Brigadier packet suggestions, async tab-completions, and permission handling) on all supported versions.

**Non-Goals:**
- Splitting the project into version-specific submodules (e.g. `paper-v1_20` vs `paper-v1_21`).
- Supporting Minecraft versions older than 1.20.0 (e.g. 1.19.x or 1.16.x).
- Modifying `velocity-plugin`, `voice-server`, or `web-client`.

## Decisions

### Decision 1: Single Universal JAR over Multi-Module Architecture
- **Choice**: Deliver a single universal JAR for all Paper 1.20.x and 1.21.x installations.
- **Rationale**: The VoiceEngine Paper plugin interacts only with stable Bukkit/Spigot APIs (`Player`, `Location`, `Particle`, `YamlConfiguration`), Adventure MiniMessage, and Incendo Cloud 2.0. None of these require NMS (net.minecraft.server) or version-specific internal reflection. Maintaining separate modules adds unnecessary build complexity and distribution friction.
- **Alternatives considered**: Separate subprojects or classifier jars (`VoiceEngine-paper-1.20.jar` vs `VoiceEngine-paper-1.21.jar`), rejected as redundant maintenance overhead.

### Decision 2: Bytecode target Java 17 (`--release 17`)
- **Choice**: Configure `JavaCompile` with `--release 17` and set Gradle toolchain / `targetJava = 17`.
- **Rationale**: Paper 1.20.0–1.20.4 runs on Java 17 runtime environments. Java 17 bytecode runs natively on both Java 17 and Java 21 (Paper 1.20.5+ and 1.21+). The plugin codebase only uses language features available in Java 17 (Records, Pattern Matching, Text Blocks).
- **Alternatives considered**: Compiling with Java 21 and instructing users to update Java; rejected because Minecraft 1.20.0–1.20.4 servers are frequently hosted in environments pinned to Java 17.

### Decision 3: Use `LegacyPaperCommandManager<CommandSender>`
- **Choice**: In `CommandService`, instantiate `LegacyPaperCommandManager.createNative(plugin, ExecutionCoordinator.simpleCoordinator())` and pass `CommandSender` as the command actor type.
- **Rationale**: `LegacyPaperCommandManager` is provided by `cloud-paper:2.0.0` and extends `BukkitCommandManager<CommandSender>`. It avoids compile-time and runtime dependencies on `CommandSourceStack`, while automatically supporting Brigadier registration (`registerBrigadier()`) and asynchronous completions (`registerAsynchronousCompletions()`) on Paper.
- **Alternatives considered**: Using vanilla `BukkitCommandManager` without Paper optimizations, rejected because `LegacyPaperCommandManager` preserves async completion listeners on Paper.

### Decision 4: Set `api-version: '1.20'` and baseline `paper-api:1.20.4-R0.1-SNAPSHOT`
- **Choice**: Specify `api-version: '1.20'` in `plugin.yml` and depend on `1.20.4-R0.1-SNAPSHOT` in `build.gradle.kts`.
- **Rationale**: Paper 1.20.x rejects plugins with `api-version: '1.21'`, whereas Paper 1.21.x fully supports plugins with `api-version: '1.20'`. Compiling against 1.20.4 ensures no 1.21-exclusive API methods are called.

## Risks / Trade-offs

- **[Risk] Deprecation warnings on modern Paper 1.21.x for legacy command map**
  - *Mitigation*: `LegacyPaperCommandManager` dynamically registers native Brigadier integration when `CloudBukkitCapabilities.NATIVE_BRIGADIER` is present on the server, avoiding command map degradation.
- **[Risk] Command signature changes breaking existing unit tests**
  - *Mitigation*: Existing unit tests in `paper-plugin` (`VoiceCommandsTest`, `AudioCommandsTest`, `SpeakerCommandsTest`) will be updated to test with `CommandSender` / `Player` mocks.
