# Secure Browser Operations

The Android secure browser enforces the active policy payload emitted by the API.

Current implementation state:

1. Navigation is evaluated locally before the WebView opens a URL.
2. Blocklist rules win before allowlist rules.
3. Allowlist rules match parsed HTTP(S) origins and exact/path-prefix rules; wildcard path prefixes may end in `*`. Lookalike hosts, embedded credentials, and non-web schemes are rejected.
4. Unmatched URLs follow the policy default: `ALLOW` or `DENY`.
5. Blocked navigation shows a local blocked page and queues a privacy-limited blocked event containing the domain, decision reason, matched rule, policy identity/version, and timestamp. The bounded queue survives offline operation for a future authenticated uploader.
6. Android Enterprise managed configuration supplies `policyId`, `policyVersion`, `defaultWebAccess`, `urlAllowlistJson`, `urlBlocklistJson`, and `homeUrl`. Valid policy is cached and reused offline; a device with neither managed nor cached policy fails closed.

Managed configuration is refreshed when Android broadcasts an application-restrictions change. Direct API policy sync remains a future integration path.

Blocked event uploads should include only device identity, domain, reason, matched rule,
policy version, and timestamp. Do not capture page contents, screenshots, keystrokes,
private messages, webcam, microphone, or unrelated browsing history.
