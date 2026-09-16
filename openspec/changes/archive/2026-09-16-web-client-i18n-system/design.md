## Context

See `proposal.md` for motivation.
The VoiceEngine web client is a React 19, Vite 6, Tailwind v4 SPA. It currently renders audio controls, spatial radar indicators, and channel lists with mixed hardcoded English and Spanish text strings. The client does not use an external internationalization library.

## Goals / Non-Goals

**Goals:**
- Provide a zero-dependency, type-safe i18n engine implemented directly in TypeScript and React 19 Context.
- Support English (`en`) and Spanish (`es`) with complete parity across all client UI components.
- Enable automatic locale detection respecting URL parameters, stored player preferences, and browser defaults.
- Deliver dual UI controls: a quick header toggle for instant pre-connection access and a full selector in the Preferences tab of the audio settings modal.
- Provide runtime English fallback for any unmapped keys and simple `{placeholder}` string interpolation.

**Non-Goals:**
- External dynamic bundle fetching (e.g. fetching translation JSONs from remote CDNs over HTTP); both locales are compiled directly into the client bundle to maintain instant offline-ready access.
- Translating dynamic backend-configured branding (e.g., custom Minecraft server names, server welcome messages, or custom channel descriptions configured in Paper).
- Pluralization rules beyond simple parameterized templates.

## Decisions

### Decision 1: Native React Context vs External i18n Library
- **Decision**: Build a custom `I18nProvider` and `useTranslation()` hook in `web-client/src/i18n/` rather than adding `i18next` or `react-i18next`.
- **Rationale**: Keeps the client bundle minimal (0 additional npm dependencies, <2KB of TypeScript), avoids React 19 peer-dependency warnings, and enables 100% compile-time type validation where `es.ts` is strictly typed against `en.ts` (`export const es: Translations = { ... }`).
- **Alternatives considered**:
  - `i18next` / `react-i18next`: Well-established, but introduces ~25KB of minified code, extra configuration boilerplate, and runtime overhead not required for a voice client HUD.
  - `rosetta` / `typesafe-i18n`: Lighter than i18next, but still introduces external dependencies without significant benefit over native typed contexts.

### Decision 2: Dictionary Structure and Type Safety
- **Decision**: Define canonical translations in `locales/en.ts` as a nested object with `as const`. Derive the TypeScript type `Translations = typeof en`. The Spanish dictionary `locales/es.ts` is explicitly typed as `Translations`.
- **Rationale**: If any key is added to `en.ts` and omitted in `es.ts`, the TypeScript compiler (`tsc -b`) immediately produces a compile-time error.
- **Alternatives considered**:
  - Separate raw JSON files: Lacks compile-time structural enforcement unless paired with custom code generation scripts.

### Decision 3: Cascading Locale Resolution
- **Decision**: Implement resolution priority:
  1. `?lang=` query parameter (case-insensitive, normalized: `es*` -> `es`, `en*` -> `en`).
  2. `localStorage.getItem('voiceengine:language')`.
  3. `navigator.language` (if starts with `es` -> `es`, else -> `en`).
  4. Default: `'en'`.
- **Rationale**: Paper and Velocity can pass the player's in-game client locale in the `/voice` connect URL (e.g. `?token=XYZ&lang=es`), providing instant localization without player intervention.

### Decision 4: Translation Function and Interpolation
- **Decision**: The `t(key: TranslationKey, params?: Record<string, string | number>)` function traverses the active locale dictionary using dot-notation. If a resolved value is undefined, it resolves against `en.ts`. Placeholders formatted as `{paramName}` are substituted using regex replacement.
- **Rationale**: Fast, allocation-light, and handles dynamic strings like `t('settings.players.count', { count: activePlayers.length })`.

### Decision 5: UI Components
- **Decision**: Create a dedicated `LanguageSelector` component supporting two variants:
  - `compact`: A minimalist pill button with a Globe icon (`lucide-react`) and code indicator (`ES` / `EN`) rendered in the header of `PlayerRoute`.
  - `full`: A dual card / radio button group rendered in the `preferences` tab of `SettingsModal`.

## Risks / Trade-offs

- **[Risk] UI layout overflow on longer localized strings**: Spanish translations can be 15-25% longer than English equivalents.
  - *Mitigation*: Existing UI buttons and modal cards utilize flexbox layout with wrapping, truncate indicators, and min-width constraints. Verified through visual testing.
- **[Risk] Audio stream re-initialization during language switch**: Changing React state at the root could inadvertently remount media streams if not decoupled.
  - *Mitigation*: Audio pipelines and WebRTC signaling are stored in stable refs (`micPipelineRef`, `pipelineRef`, `signalingRef`) in `PlayerRoute`, decoupled from visual translation state.
