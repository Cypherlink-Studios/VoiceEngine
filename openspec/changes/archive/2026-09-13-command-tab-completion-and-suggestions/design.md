## Context

Both `paper-plugin` and `velocity-plugin` use the **Incendo Cloud 2.0.0** framework (`cloud-paper` and `cloud-velocity` with `cloud-annotations`).
While Cloud provides automatic literal subcommand suggestion (e.g. `audio`, `speaker`, `mute`), dynamic and typed arguments (`String id`, `String player`, `String duration`, `String source`) default to empty suggestions unless linked to registered `@Suggestions` providers or typed parsers.

`AudioCommands` already demonstrates the working pattern via `@Suggestions("mediaFiles")`. This design extends that pattern across all command arguments in both plugins.

## Goals / Non-Goals

**Goals:**
- Provide instant, context-aware suggestions in Paper for active audio emitters, speaker IDs, online Bukkit players, volume levels, purge durations, and media files.
- Provide instant suggestions in Velocity for online proxy players and standard punishment duration formats.
- Maintain backwards compatibility and keep command execution methods unchanged.

**Non-Goals:**
- Restricting input to only suggested values (e.g. banning an offline player by manually typing their name must still be supported).
- Changing command aliases, permission nodes, or MiniMessage output formats.

## Decisions

### Decision 1: Use Method-Level `@Suggestions` Providers in Command Classes
- **Choice**: Add methods annotated with `@Suggestions("<name>")` directly in `AudioCommands`, `SpeakerCommands`, and `VelocityModerationCommands`.
- **Rationale**: Keeps suggestion logic co-located with the commands that use them. Matches the existing pattern established by `AudioCommands.suggestMediaFiles`.
- **Alternative considered**: Registering global `SuggestionProvider` instances on `CommandManager`. Rejected because co-located annotations are cleaner, standard in Cloud Annotations, and easier to unit test.

### Decision 2: Inject `AudioManager` into `SpeakerCommands`
- **Choice**: Pass `AudioManager` into `SpeakerCommands` constructor so it can provide `mediaFiles` suggestions for `/voice speaker play <id> <source>`.
- **Rationale**: Ensures parity between `/voice audio play` and `/voice speaker play` when selecting local audio files from `plugins/VoiceEngine/media/`.
- **Alternative considered**: Duplicating media file scanning in `SpeakerManager`. Rejected to maintain single-source-of-truth in `AudioManager`.

### Decision 3: Keep Player Arguments as `String` with Suggestions
- **Choice**: Keep `@Argument(value = "player", suggestions = "onlinePlayers") String playerName` rather than switching to Bukkit's `Player` type directly.
- **Rationale**: Allows punishment and speaker commands to handle player lookups and gracefully report custom translated errors (`command.moderation.player_not_found`) when an offline or invalid player is specified.

## Risks / Trade-offs

- **[Risk] High Player Count on Proxy**: Querying `proxyServer.getAllPlayers()` on every keystroke in a massive network could create allocations.
  → **Mitigation**: `proxyServer.getAllPlayers()` returns an in-memory collection; mapping to usernames is lightweight and Cloud filters suggestions client-side or during packet handling asynchronously via Brigadier.
- **[Risk] Offline Player Punishments**: Autocompletion only displays online players.
  → **Mitigation**: Because the argument parser remains `String`, staff can still type any username manually to punish an offline player.
