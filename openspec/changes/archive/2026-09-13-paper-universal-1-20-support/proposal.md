## Why

The Paper plugin currently targets Java 21 and depends on Paper 1.21.4 with modern Brigadier `CommandSourceStack`, preventing it from running on Minecraft 1.20.x servers (such as 1.20.1 and 1.20.4, which run on Java 17 and lack `io.papermc.paper.command.brigadier.CommandSourceStack`). Many server networks still operate on Minecraft 1.20.x or support mixed version environments. Delivering a single universal JAR that runs smoothly on all Paper versions from 1.20.0 through 1.21.4 expands adoption without requiring separate plugin artifacts or complex multi-module builds.

## What Changes

- **Java Bytecode Baseline**: Set compilation target to Java 17 (`targetJava = 17` / `--release 17`) in `paper-plugin/build.gradle.kts`. Java 17 bytecode executes natively on both Java 17 (1.20.0–1.20.4) and Java 21 (1.20.5+ and 1.21+).
- **Paper API Baseline**: Change compile-time dependency from `paper-api:1.21.4-R0.1-SNAPSHOT` to `paper-api:1.20.4-R0.1-SNAPSHOT` to prevent unintended usages of 1.21-only Paper methods while maintaining forward compatibility on 1.21.x.
- **Plugin Descriptor (`plugin.yml`)**: Update `api-version` from `'1.21'` to `'1.20'`, enabling Paper 1.20.x servers to accept the plugin without version mismatch warnings or load failures.
- **Universal Command Manager**: Replace `PaperCommandManager<CommandSourceStack>` with `LegacyPaperCommandManager<CommandSender>` in `CommandService.java`.
- **Sender Normalization in Commands**: Update `VoiceCommands`, `AudioCommands`, and `SpeakerCommands` to accept `CommandSender sender` directly, eliminating runtime coupling to `CommandSourceStack`.
- **Dynamic Feature Negotiation**: Automatically register native Brigadier integration (`registerBrigadier()`) and asynchronous completions (`registerAsynchronousCompletions()`) based on server runtime capabilities.
- **Test Suite Updates**: Adapt unit tests in `paper-plugin` to verify command handling with `CommandSender`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `paper-voice-bridge`: Introduces multi-version server compatibility requirements (Java 17 runtime baseline, `api-version: '1.20'`, universal command sender dispatch across Paper 1.20.0–1.21.4).

## Impact

- **Affected Modules**: `paper-plugin` (`build.gradle.kts`, `plugin.yml`, `CommandService.java`, `VoiceCommands.java`, `AudioCommands.java`, `SpeakerCommands.java`, and related test classes).
- **Runtime Compatibility**: Paper servers from 1.20.0 to 1.21.4 can load and run the exact same `VoiceEngine-paper.jar`.
- **Network / API**: No breaking changes to the WebSocket protocol, VoiceBackendClient, SFU, or Web Client.
