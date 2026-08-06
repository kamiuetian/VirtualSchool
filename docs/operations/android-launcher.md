# Managed Android launcher

The launcher is the HOME application for school-owned Android Enterprise devices. Android Management API delivers its active policy through application restrictions; no tenant secret or student credential is stored in the app.

## Managed configuration

Policy publication supplies `policyId`, `policyVersion`, `mode`, `approvedAppsJson`, `webShortcutsJson`, `showMessages`, and `showSupportContact`. Only apps whose install policy is not `BLOCKED` are included. Links are limited to HTTP or HTTPS and always open in the managed secure-browser package.

The launcher stores the last valid managed configuration in private app preferences. If restrictions are temporarily unavailable while the device is offline, that last-known policy remains enforced. Android's application-restrictions change broadcast causes an immediate refresh after policy delivery; resuming the launcher also reloads policy.

## Pilot behavior

- Only explicitly configured, syntactically valid package names are rendered. Duplicate or malformed entries are discarded.
- The current learning mode and policy version remain visible.
- Lost Device Mode hides apps and links and displays a school-return message.
- The back action is disabled. Android Enterprise custom-launcher and kiosk controls provide the actual hard-to-exit boundary; the app does not attempt to bypass Android administration.
- If no managed or cached policy exists, the fail-closed default exposes no apps or links and shows the support prompt.

## Pilot checks

Publish two successive policies and verify the header, app set, and shortcuts update. Disconnect the device, restart the launcher, and verify the last-known policy remains. Reconnect and publish another version to verify refresh. Exercise Lost Device Mode and confirm no learning apps or links are shown.

For local verification, run `:apps:android-launcher:testDebugUnitTest`, `:apps:android-launcher:lintDebug`, and `:apps:android-launcher:assembleDebug` with the repository Gradle build.
