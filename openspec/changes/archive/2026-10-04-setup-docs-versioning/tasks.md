# Tasks: Setup Plugin Documentation Versioning

## 1. Portal Manifest & Metadata Configuration

- [x] 1.1 Create `docs/metadata.yml` conforming to `RemotePluginMetadataSchema` defining plugin metadata, platforms (`paper`, `purpur`, `velocity`), Minecraft support (`1.20.4+`), Java compatibility (17/21), Folia status (`unsupported`), and active version `1.0.0` (commit `bcde65d`), and verify file exists.

## 2. Spanish Documentation Suite (`docs/es/`)

- [x] 2.1 Create `docs/es/index.md` with Starlight frontmatter (`order: 1`) covering system overview, zero-mod WebRTC architecture, and audio processing fundamentals, and verify file exists.
- [x] 2.2 Create `docs/es/getting-started.md` with Starlight frontmatter (`order: 2`) covering installation for Paper standalone and Velocity proxy networks, and verify file exists.
- [x] 2.3 Create `docs/es/configuration.md` with Starlight frontmatter (`order: 3`) covering full configuration reference for `config.yml` on Paper and Velocity, and verify file exists.
- [x] 2.4 Create `docs/es/commands-and-permissions.md` with Starlight frontmatter (`order: 4`) detailing commands (`/voice`, `/voicemoderation`, `/audioemitter`, `/speaker`) and permission nodes, and verify file exists.
- [x] 2.5 Create `docs/es/speaker-blocks-and-emitters.md` with Starlight frontmatter (`order: 5`) detailing speaker blocks, redstone megaphones, and dynamic 3D audio emitters, and verify file exists.
- [x] 2.6 Create `docs/es/moderation-and-security.md` with Starlight frontmatter (`order: 6`) detailing sanctions (`mute`, `deafen`, `kick`, `ban`), SQLite WAL engine, and real-time SFU websocket sync, and verify file exists.
- [x] 2.7 Create `docs/es/deployment-and-observability.md` with Starlight frontmatter (`order: 7`) detailing Docker/Linux SFU deployment, SSL/WSS setup, and Prometheus/Grafana metrics, and verify file exists.
- [x] 2.8 Create `docs/es/developer-api.md` with Starlight frontmatter (`order: 8`) detailing Paper & Velocity event listeners and service APIs, and verify file exists.

## 3. English Documentation Suite (`docs/en/`)

- [x] 3.1 Create `docs/en/index.md` with 1:1 slug parity and frontmatter matching `docs/es/index.md`, and verify file exists.
- [x] 3.2 Create `docs/en/getting-started.md` with 1:1 slug parity and frontmatter matching `docs/es/getting-started.md`, and verify file exists.
- [x] 3.3 Create `docs/en/configuration.md` with 1:1 slug parity and frontmatter matching `docs/es/configuration.md`, and verify file exists.
- [x] 3.4 Create `docs/en/commands-and-permissions.md` with 1:1 slug parity and frontmatter matching `docs/es/commands-and-permissions.md`, and verify file exists.
- [x] 3.5 Create `docs/en/speaker-blocks-and-emitters.md` with 1:1 slug parity and frontmatter matching `docs/es/speaker-blocks-and-emitters.md`, and verify file exists.
- [x] 3.6 Create `docs/en/moderation-and-security.md` with 1:1 slug parity and frontmatter matching `docs/es/moderation-and-security.md`, and verify file exists.
- [x] 3.7 Create `docs/en/deployment-and-observability.md` with 1:1 slug parity and frontmatter matching `docs/es/deployment-and-observability.md`, and verify file exists.
- [x] 3.8 Create `docs/en/developer-api.md` with 1:1 slug parity and frontmatter matching `docs/es/developer-api.md`, and verify file exists.

## 4. Portal Registry Registration & Build Verification

- [x] 4.1 Create `DarkBladeDev-plugins/src/data/plugins/voiceengine.yaml` defining portal registry entry for VoiceEngine with `localPath` pointing to `../../MISC/VoiceEngine/docs`, and verify file exists.
- [x] 4.2 Validate documentation parity between `docs/es/` and `docs/en/` ensuring exact 1:1 filename match across all 8 guides.
- [x] 4.3 Run `pnpm test` and `pnpm check` in `DarkBladeDev-plugins` to verify Zod schema validation and TypeScript compilation pass with 0 errors.
- [x] 4.4 Run `pnpm build` in `DarkBladeDev-plugins` to verify full static site generation with VoiceEngine documentation pages.
