# web-client-spatial-audio Spec Delta

## MODIFIED Requirements

### Requirement: Streamer Privacy Masking Mode
The web client SHALL provide a streamer mode toggle that conceals sensitive server details, tokens, URL query parameters, and coordinates from UI displays across both pre-authentication and connected views, synchronized bidirectionally with Minecraft.

#### Scenario: Masking sensitive tokens and coordinates
- **WHEN** streamer mode is enabled
- **THEN** the client SHALL mask the join token, session URL parameters, server hostnames, temporary room PINs, and exact relative coordinates in player inspection popovers with obfuscated placeholders.

#### Scenario: Immediate URL token sanitization on load
- **WHEN** the web client loads `/` with a `?token=` or `?code=` query parameter
- **THEN** the client SHALL read the parameter into memory and immediately remove `token` and `code` from the browser URL bar using `window.history.replaceState` before or without rendering the credential in the address bar.

#### Scenario: Masked login code input on welcome card
- **WHEN** a user views the pre-authentication connection card with Streamer Mode enabled (or after arriving via a tokenized URL)
- **THEN** the token input field SHALL render characters masked (`type="password"`) and provide a toggle button to reveal or hide the code on demand.

#### Scenario: Bidirectional sync on authentication and live settings toggle
- **WHEN** the web client receives `auth_success.streamerMode` or a live `streamer_mode_changed` frame from the backend, OR the user toggles Streamer Mode in `SettingsModal` while connected
- **THEN** the web client SHALL update its active `streamerMode` state and `localStorage` (`voiceengine:streamer_mode`), and SHALL emit `streamer_mode_update` over WebSocket when toggled from the web settings UI.
