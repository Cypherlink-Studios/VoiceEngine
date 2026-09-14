## 1. Build and Descriptor Configuration

- [x] 1.1 Update `paper-plugin/build.gradle.kts` to target Java 17 bytecode (`targetJava = 17`, `options.release.set(17)`) and set API baseline to `io.papermc.paper:paper-api:1.20.4-R0.1-SNAPSHOT`.
- [x] 1.2 Update `paper-plugin/src/main/resources/plugin.yml` to specify `api-version: '1.20'`.

## 2. Universal Command System Migration

- [x] 2.1 Migrate `CommandService.java` to `LegacyPaperCommandManager<CommandSender>` with dynamic registration for `CloudBukkitCapabilities.NATIVE_BRIGADIER` and `CloudBukkitCapabilities.ASYNCHRONOUS_COMPLETION`.
- [x] 2.2 Update `VoiceCommands.java` method signatures to accept `CommandSender sender` instead of `CommandSourceStack stack`.
- [x] 2.3 Update `AudioCommands.java` method signatures to accept `CommandSender sender` instead of `CommandSourceStack stack`.
- [x] 2.4 Update `SpeakerCommands.java` method signatures to accept `CommandSender sender` instead of `CommandSourceStack stack`.

## 3. Test Suite & Verification

- [x] 3.1 Update `VoiceCommandsTest`, `AudioCommandsTest`, and `SpeakerCommandsTest` to test command methods using `CommandSender` and `Player` mocks.
- [x] 3.2 Run `./gradlew :paper-plugin:test` and verify all tests compile and pass.
- [x] 3.3 Assemble `VoiceEngine-paper.jar` via `./gradlew :paper-plugin:assemble` and verify the class file version is 61.0 (Java 17 bytecode).
