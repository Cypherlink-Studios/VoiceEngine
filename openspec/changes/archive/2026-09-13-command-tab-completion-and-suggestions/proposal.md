# Proposal: Command Tab Completion and Argument Suggestions

## Why

Currently, administrative commands in both the Paper plugin and the Velocity proxy require staff to manually type entity identifiers (audio emitter IDs, speaker IDs), file paths, duration strings, and player usernames without interactive tab completion or suggestions. Adding comprehensive argument completion in Incendo Cloud prevents syntax mistakes, speeds up administrative moderation across the proxy network, and dramatically improves staff quality of life.

## What Changes

- Add `@Suggestions` providers in `paper-plugin`'s `AudioCommands` for active emitter IDs, stoppable emitters (including `all`), volume presets, cache purge durations, and particle toggles.
- Add `@Suggestions` providers in `paper-plugin`'s `SpeakerCommands` for existing speaker IDs, online Bukkit player names, media file sources, and boolean states.
- Add `@Suggestions` providers in `velocity-plugin`'s `VelocityModerationCommands` for online proxy player usernames and human-readable punishment durations (`15m`, `1h`, `1d`, `7d`, `permanent`).
- Update argument definitions in command signatures to link to their respective suggestion providers.

## Capabilities

### New Capabilities
*(None)*

### Modified Capabilities
- `audio-emitters`: Adds interactive tab completion requirements for emitter IDs, stoppable targets, volume presets, purge durations, and particle toggles.
- `speaker-blocks`: Adds interactive tab completion requirements for speaker IDs, player names, media sources, and boolean redstone toggles.
- `voice-moderation`: Adds interactive tab completion requirements for player usernames and punishment duration suggestions in proxy moderation commands.

## Impact

- **Paper Plugin**: `com.voiceengine.command.AudioCommands`, `com.voiceengine.command.SpeakerCommands`, and associated tests.
- **Velocity Plugin**: `com.voiceengine.velocity.command.VelocityModerationCommands` and associated tests.
- **Dependencies**: Uses existing `org.incendo:cloud-paper` and `org.incendo:cloud-velocity` 2.0.0 frameworks without adding new external dependencies.
- **API/Backwards Compatibility**: No breaking changes; existing command syntax remains 100% compatible.
