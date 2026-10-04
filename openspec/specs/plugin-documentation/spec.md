# plugin-documentation Specification

## Purpose

Provides structured, versioned, and localized documentation for VoiceEngine conforming to the DarkBladeDev ecosystem portal specification and Starlight Astro loader rules.

## Requirements

### Requirement: Portal Metadata Configuration
The repository SHALL maintain a `docs/metadata.yml` file conforming to `RemotePluginMetadataSchema` defining plugin identity (`voiceengine`), platform compatibility (`paper`, `purpur`, `velocity`), runtime requirements (Java 17/21, Minecraft 1.20.4+), Folia status (`unsupported`), external links, documentation locales (`es`, `en`), and a `versions` collection where index 0 represents the active release `1.0.0` (commit `bcde65d`).

#### Scenario: Valid metadata ingestion
- **WHEN** the DarkBladeDev portal content loader parses `docs/metadata.yml`
- **THEN** it successfully validates against the Zod schema, identifies `1.0.0` as the active canonical release, and extracts metadata without errors.

### Requirement: Multilingual Documentation Parity
The documentation SHALL be organized into `docs/es/` and `docs/en/` subdirectories with identical kebab-case filenames across both locales, ensuring strict 1:1 slug parity.

#### Scenario: 1:1 Slug parity across locales
- **WHEN** the content loader or documentation validator inspects localized files
- **THEN** every markdown document in `docs/es/` has a matching document in `docs/en/` with the exact same filename.

### Requirement: Starlight Frontmatter Specification
Every documentation page SHALL define YAML frontmatter specifying `title`, `description`, and `sidebar.order`.

#### Scenario: Frontmatter parsing
- **WHEN** Astro and Starlight compile the documentation pages
- **THEN** all pages are indexed with the appropriate page title, navigation hierarchy, and metadata description without build errors.

### Requirement: VoiceEngine Core Systems Guide Coverage
The documentation suite SHALL provide comprehensive guides covering all features implemented up to version 1.0.0 across eight specific files: `index.md`, `getting-started.md`, `configuration.md`, `commands-and-permissions.md`, `speaker-blocks-and-emitters.md`, `moderation-and-security.md`, `deployment-and-observability.md`, and `developer-api.md`.

#### Scenario: Complete feature coverage
- **WHEN** a server owner or developer reads the documentation suite
- **THEN** they find accurate syntax references for Paper & Velocity setup, 3D WebRTC audio, RNNoise DSP, speaker blocks & redstone megaphones, positional dynamic audio emitters, SQLite moderation, deployment, and the Java API.

### Requirement: Portal Registry Integration
The plugin SHALL be registered in the DarkBladeDev portal registry at `DarkBladeDev-plugins/src/data/plugins/voiceengine.yaml` defining repository source, default branch, tags, platforms, and a local path override for offline development builds.

#### Scenario: Portal registry resolution
- **WHEN** the documentation portal builds or runs tests
- **THEN** it resolves VoiceEngine from the registry, links its documentation pages, and renders its catalog page without schema validation errors.
