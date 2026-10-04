# Design: Setup Plugin Documentation Versioning

## Context

VoiceEngine previously maintained disparate documentation folders (`docs/plugin/paper/`, `docs/plugin/velocity/`, `docs/installation/`, `docs/observability/`, and `docs/architecture/`) with inconsistent metadata and no language localization. The DarkBladeDev documentation portal uses Astro + Starlight with a dynamic remote loader (`github-docs-loader.ts`) that expects `docs/metadata.yml`, language subdirectories (`docs/es/` and `docs/en/`), and 1:1 filename parity.

See `proposal.md` for background and problem motivation.

## Goals / Non-Goals

**Goals:**
- Provide a valid `docs/metadata.yml` conforming to `RemotePluginMetadataSchema`.
- Author 8 comprehensive guides in both Spanish (`docs/es/`) and English (`docs/en/`) with strict 1:1 kebab-case slug parity and Starlight frontmatter.
- Register `VoiceEngine` into the DarkBladeDev documentation portal registry (`DarkBladeDev-plugins/src/data/plugins/voiceengine.yaml`).
- Verify that the portal loads VoiceEngine locally without schema errors or build failures.

**Non-Goals:**
- Modifying VoiceEngine Java source code, plugin binaries, or configuration defaults.
- Modifying internal audit notes in `docs/.internal/`.
- Creating historical archived versions older than 1.0.0 (1.0.0 is the initial public release).

## Decisions

### Decision 1: Metadata Manifest Specification
- **Choice**: Place `metadata.yml` at the root of `docs/`. Define active version `1.0.0` at index 0 targeting commit SHA `bcde65d`.
- **Rationale**: `github-docs-loader.ts` requires `versions[0]` to be the active version served at canonical `/docs/voiceengine/`. Targeting the fixed commit SHA ensures reproducible caching.
- **Alternatives Considered**: Using branch `main` as the reference. Rejected because commit SHAs provide immutable caching in `.cache/docs-archives/`.

### Decision 2: 1:1 Slug Parity and File Layout
- **Choice**: Structure docs under `docs/es/` (default locale) and `docs/en/` using identical kebab-case filenames:
  1. `index.md` (order: 1)
  2. `getting-started.md` (order: 2)
  3. `configuration.md` (order: 3)
  4. `commands-and-permissions.md` (order: 4)
  5. `speaker-blocks-and-emitters.md` (order: 5)
  6. `moderation-and-security.md` (order: 6)
  7. `deployment-and-observability.md` (order: 7)
  8. `developer-api.md` (order: 8)
- **Rationale**: Starlight language switching requires matching slugs between locales. Differing filenames break the locale switcher and produce 404s.
- **Alternatives Considered**: Keeping module-based subfolders (`paper/`, `velocity/`). Rejected because flat kebab-case slugs align with existing DarkBladeDev plugin portals (CinematicEngine, CraftingEngine).

### Decision 3: Starlight Frontmatter Formatting
- **Choice**: Include `title`, `description`, and `sidebar.order` in frontmatter. Avoid leading `# H1` headings in markdown bodies.
- **Rationale**: Starlight automatically injects `<h1>` from the frontmatter `title`. An extra `# H1` in markdown generates duplicate title warnings and rendering artifacts.

### Decision 4: Portal Registry Registration
- **Choice**: Create `DarkBladeDev-plugins/src/data/plugins/voiceengine.yaml` referencing `repo: Cypherlink-Studios/VoiceEngine`, branch `main`, and `localPath: "../../MISC/VoiceEngine/docs"`.
- **Rationale**: Enables local site development, fast compilation during portal builds, and immediate testing with `pnpm test` and `pnpm check`.

## Risks / Trade-offs

- **[Risk]** Existing links in external READMEs pointing to old paths like `docs/plugin/paper/` might break.
  - **Mitigation**: Update root `README.md` and keep legacy folders or clean references to point to new canonical portal paths.
- **[Risk]** Missing translation parity in future PRs.
  - **Mitigation**: The specification checklist and loader validate that all slugs match across locales, logging warnings in CI/CD when missing.

## Migration Plan

1. Generate `docs/metadata.yml`.
2. Author all 8 documentation guides in `docs/es/`.
3. Author all 8 matching documentation guides in `docs/en/`.
4. Register `voiceengine.yaml` in `DarkBladeDev-plugins/src/data/plugins/`.
5. Run tests and type checks in the portal.
