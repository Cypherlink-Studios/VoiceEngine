## ADDED Requirements

### Requirement: Client Localization and Multilingual Interface (i18n)
The web client SHALL support full internationalization and dynamic localization across all user-facing interface elements, providing matching dictionaries for English (`en`) and Spanish (`es`), automatic locale detection with cascading fallbacks, and real-time language switching without interrupting active audio sessions.

#### Scenario: URL parameter locale initialization
- **WHEN** a player navigates to the web client with a `lang` URL query parameter specifying a supported language code (e.g., `?lang=es` or `?lang=en`)
- **THEN** the client SHALL initialize its interface in the designated language, update the current locale state, and persist the preference to local storage.

#### Scenario: User preference persistence
- **WHEN** a player explicitly selects a language through the header quick switcher or the Settings preferences tab
- **THEN** the client SHALL immediately update all rendered text strings in the UI, persist the selection to `localStorage` under `voiceengine:language`, and maintain this selection across page reloads.

#### Scenario: Browser locale automatic detection
- **WHEN** the client is loaded without a URL `lang` parameter and without an existing `localStorage` preference
- **THEN** the client SHALL evaluate `navigator.language`, selecting Spanish if the language tag begins with `es` (e.g., `es-ES`, `es-419`, `es-MX`), and defaulting to English for all other locales.

#### Scenario: Runtime fallback for missing translation keys
- **WHEN** a translation key requested by a component is missing or incomplete in the currently selected locale dictionary
- **THEN** the translation engine SHALL fall back to the corresponding key in the primary English (`en`) dictionary, avoiding blank labels or rendering errors.

#### Scenario: Dynamic variable interpolation
- **WHEN** a localized string template contains named interpolation placeholders (e.g., `{count}` for player counts or `{ms}` for latency)
- **THEN** the translation function SHALL substitute the provided parameter values into the template and return the fully formatted text.

#### Scenario: Seamless language switching during active voice call
- **WHEN** a user changes the interface language while an active WebRTC voice session and spatial audio rendering are in progress
- **THEN** the client SHALL update all visual components and labels instantly without renegotiating WebRTC peer connections, resetting AudioContext state, or disrupting voice transmission.
