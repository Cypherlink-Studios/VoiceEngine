## ADDED Requirements

### Requirement: Universal Multi-Version Minecraft Compatibility (1.20.0 - 1.21.4)
The Paper plugin SHALL be packaged as a single universal binary compiled for Java 17 bytecode targeting `api-version: '1.20'`, capable of loading and functioning on Paper servers from version 1.20.0 through 1.21.4 without requiring version-specific builds.

#### Scenario: Plugin loading on Java 17 and Minecraft 1.20.x servers
- **WHEN** the plugin JAR is placed in the plugins folder of a Paper server running Minecraft 1.20.0 through 1.20.4 on a Java 17 runtime
- **THEN** the server SHALL successfully load and enable the plugin without `UnsupportedClassVersionError` or `ClassNotFoundException`.

#### Scenario: Plugin loading on Java 21 and Minecraft 1.21.x servers
- **WHEN** the plugin JAR is placed in the plugins folder of a Paper server running Minecraft 1.21.x on a Java 21 runtime
- **THEN** the server SHALL successfully load and enable the plugin without version rejection or compatibility errors.

#### Scenario: Universal command execution and dispatch
- **WHEN** an in-game player or console administrator executes any VoiceEngine command (`/voice`, `/audio`, `/speaker`) on either a 1.20.x or 1.21.x Paper server
- **THEN** the command SHALL execute successfully using standard command sender dispatch without relying on server-version-restricted `CommandSourceStack` classes.

#### Scenario: Dynamic tab-completion and suggestion registration
- **WHEN** the plugin initializes its command manager on a running Paper server
- **THEN** the plugin SHALL negotiate available capabilities, enabling native Brigadier completion if supported, asynchronous tab completions if supported, or falling back gracefully to standard Bukkit completions.
