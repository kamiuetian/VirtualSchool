# Secure Browser Operations

The Android secure browser enforces the active policy payload emitted by the API.

Current implementation state:

1. Navigation is evaluated locally before the WebView opens a URL.
2. Blocklist rules win before allowlist rules.
3. Allowlist rules can match exact URLs, path prefixes, or wildcard prefixes ending in `*`.
4. Unmatched URLs follow the policy default: `ALLOW` or `DENY`.
5. Blocked navigation shows a local blocked page and records a privacy-limited blocked event.

The browser currently uses a local sample policy until Android policy sync is wired to
`GET /api/v1/tenants/{tenantId}/policies/devices/{deviceId}/payload`.

Blocked event uploads should include only device identity, URL, reason, matched rule,
policy version, and timestamp. Do not capture page contents, screenshots, keystrokes,
private messages, webcam, microphone, or unrelated browsing history.
