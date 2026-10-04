# Proposal: Setup Plugin Documentation Versioning

## Why

VoiceEngine is a browser-based 3D proximity voice chat and media streaming engine for Minecraft Paper servers and Velocity networks. However, its documentation is currently split across disparate, monolingual subdirectories (`docs/plugin/paper/`, `docs/plugin/velocity/`, `docs/architecture/`, etc.) without a unified portal metadata manifest.

To integrate VoiceEngine into the DarkBladeDev documentation portal (Astro + Starlight driven by `github-docs-loader.ts`), the repository needs a canonical `docs/metadata.yml` conforming to `RemotePluginMetadataSchema`, full Spanish (`docs/es/`) and English (`docs/en/`) documentation with 1:1 filename parity, Starlight-compliant frontmatter, and registration in the portal catalog (`src/data/plugins/voiceengine.yaml`).

## What Changes

- Create `docs/metadata.yml` conforming to `RemotePluginMetadataSchema` defining plugin metadata, platforms (`paper`, `purpur`, `velocity`), Minecraft support (`1.20.4+`), Java compatibility (17/21), Folia status (unsupported), and version `1.0.0` as the active release (`bcde65d`).
- Structure bilingual documentation in `docs/es/` and `docs/en/` with strict 1:1 slug parity and Starlight frontmatter (`title`, `description`, `sidebar.order`).
- Consolidate existing technical guides into 8 comprehensive guides per locale:
  - `index.md`: Overview, architecture, Web Audio API, and WebRTC SFU mechanics.
  - `getting-started.md`: Step-by-step setup for Paper standalone servers and Velocity networks.
  - `configuration.md`: Comprehensive reference for `config.yml` on Paper and Velocity.
  - `commands-and-permissions.md`: Command syntax and permission tree for `/voice`, `/voicemoderation`, `/audioemitter`, and `/speaker`.
  - `speaker-blocks-and-emitters.md`: Physical world audio broadcasters, Redstone megaphones, and dynamic 3D audio emitters.
  - `moderation-and-security.md`: SQLite WAL moderation, sanctions (`mute`, `deafen`, `kick`, `ban`), IP evasion defense, and instant SFU sync.
  - `deployment-and-observability.md`: Docker/Linux deployment for Voice Server and Prometheus/Grafana metrics.
  - `developer-api.md`: Paper & Velocity Java event and service APIs for third-party integrations.
- Register `VoiceEngine` in the `DarkBladeDev-plugins` portal registry (`src/data/plugins/voiceengine.yaml`).
- Validate compatibility and builds using portal test and check suites (`pnpm test`, `pnpm check`, `pnpm build`).

## Capabilities

### New Capabilities
- `plugin-documentation`: Establishes versioned, bilingual documentation structure and portal metadata for VoiceEngine conforming to the DarkBladeDev portal loader specification.

### Modified Capabilities
<!-- None: No behavioral changes to existing server or client capabilities. -->

## Impact

- **Documentation**: New `docs/metadata.yml`, `docs/es/`, and `docs/en/` directories created. Existing internal docs (`docs/.internal/`) are preserved as-is.
- **DarkBladeDev Portal**: New registry file `DarkBladeDev-plugins/src/data/plugins/voiceengine.yaml` created to ingest VoiceEngine.
- **Build & CI**: Validated through `DarkBladeDev-plugins` build pipeline. No changes to VoiceEngine plugin binaries (`VoiceEngine-paper.jar`, `VoiceEngine-velocity.jar`).
