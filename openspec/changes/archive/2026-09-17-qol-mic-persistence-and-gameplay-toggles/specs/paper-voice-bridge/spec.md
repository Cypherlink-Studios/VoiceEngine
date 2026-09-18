## ADDED Requirements

### Requirement: Configurable In-Game Mechanics and Feature Toggles
The plugin SHALL allow administrators to independently enable or disable sneak whispering, underwater acoustics, player speaking particles, spectator voice policies, and speaker blocks via `config.yml`, applying updates dynamically upon `/voice reload`.

#### Scenario: Disabling sneak whisper attenuation
- **WHEN** `mechanics.whisper-on-sneak` is set to `false` in configuration
- **THEN** the plugin SHALL transmit `isSneaking` as `false` in spatial telemetry regardless of whether the player is crouching in Minecraft.

#### Scenario: Disabling underwater muffled acoustics
- **WHEN** `mechanics.underwater-acoustics` is set to `false` in configuration
- **THEN** the plugin SHALL transmit `isSubmerged` as `false` in spatial telemetry regardless of whether the player is in water.

#### Scenario: Disabling player speaking particles
- **WHEN** `mechanics.speaking-particles` is set to `false` in configuration
- **THEN** the plugin SHALL suppress spawning musical note particles above speaking players' heads upon receiving voice activity notifications.

#### Scenario: Enforcing spectator voice mode
- **WHEN** `mechanics.spectator-mode` is configured to `listen-only` or `isolated` and an online player enters spectator game mode or dies
- **THEN** the plugin SHALL tag the player's spatial telemetry state as a spectator so the voice backend applies the configured spectator isolation policy.

#### Scenario: Disabling speaker blocks system
- **WHEN** `speakers.enabled` is set to `false` in configuration
- **THEN** the plugin SHALL disable speaker block ticking, persistence, and reject `/voice speaker` commands with a feature disabled notification.

#### Scenario: Dynamic mechanics configuration reload
- **WHEN** an administrator modifies `mechanics` or `speakers` in `config.yml` and executes `/voice reload`
- **THEN** the plugin SHALL immediately reload and apply the updated feature toggles without restarting the server.
