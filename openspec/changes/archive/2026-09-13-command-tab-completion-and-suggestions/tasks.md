## 1. Paper Plugin Command Suggestions

- [x] 1.1 Implement `@Suggestions` providers in `AudioCommands` (`activeEmitters`, `stoppableEmitters`, `volumePresets`, `purgeDurations`, `particleStates`) and annotate arguments; verify with `./gradlew :paper-plugin:test`.
- [x] 1.2 Inject `AudioManager` into `SpeakerCommands`, implement `@Suggestions` providers (`speakers`, `onlinePlayers`, `mediaFiles`, `booleans`), and annotate arguments; verify with `./gradlew :paper-plugin:test`.
- [x] 1.3 Add unit tests for `AudioCommands` and `SpeakerCommands` suggestion providers in `paper-plugin/src/test/java/com/voiceengine/command/`; verify test suite passes with `./gradlew :paper-plugin:test`.

## 2. Velocity Plugin Command Suggestions

- [x] 2.1 Implement `@Suggestions` providers in `VelocityModerationCommands` (`networkPlayers`, `punishmentDurations`) and annotate arguments across all moderation commands; verify with `./gradlew :velocity-plugin:test`.
- [x] 2.2 Add unit tests for `VelocityModerationCommands` suggestion providers in `velocity-plugin/src/test/java/com/voiceengine/velocity/command/`; verify test suite passes with `./gradlew :velocity-plugin:test`.

## 3. Verification & Packaging

- [x] 3.1 Execute `./gradlew assemble` and verify both `VoiceEngine-paper.jar` and `VoiceEngine-velocity.jar` compile and package without errors.
