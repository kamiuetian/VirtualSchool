# Android Policy Publishing

Phase 1 publishes internal school policy versions through the active MDM connector when `POST /api/v1/tenants/:tenantId/policies/:policyId/publish` is called.

## Runtime Modes

- Default local mode uses `MDM_CONNECTOR_MODE=stub` and records a successful stub publish without calling Google.
- Production Android publishing uses `MDM_CONNECTOR_MODE=android-management`.

Required Android environment:

- `ANDROID_MANAGEMENT_ENTERPRISE_ID`
- Google service account credentials available to `google-auth-library`
- Optional `ANDROID_MANAGEMENT_API_BASE_URL` for tests or controlled integration environments
- Optional `ANDROID_LAUNCHER_PACKAGE_NAME`, default `com.virtualschool.launcher`
- Optional `ANDROID_BROWSER_PACKAGE_NAME`, default `com.virtualschool.browser`

## Publish Flow

1. The API increments the internal policy version and writes a `PolicyVersion` snapshot.
2. The API loads approved app catalog entries referenced by `rules.approvedAppPackageIds`.
3. The active MDM connector maps the internal rules to an Android Management API policy.
4. The Android connector patches `enterprises/{enterpriseId}/policies/{policyId}`.
5. The API stores publish metadata on `Policy`:
   - `mdmPolicyName`
   - `mdmPublishStatus`
   - `mdmPublishedAt`
   - `mdmPublishError`
   - `mdmPublishRequest`
   - `mdmPublishResponse`
6. Audit events record both internal publish and MDM publish outcome.

## Android Policy Mapping

The mapper creates a dedicated-device policy with:

- `kioskCustomLauncherEnabled: true`
- force-installed launcher and secure browser apps
- launcher managed configuration containing tenant, policy id, version, and mode
- browser managed configuration containing URL allow/block rules and default web access
- approved app catalog entries as Android application policies
- safe boot and app install restrictions mapped from internal policy restrictions
- factory-reset restriction mapped to `factoryResetDisabled`
- automatic, 30-day postponed, or daily-window system updates mapped to `systemUpdate`
- kiosk navigation, status-bar, and power-button behavior mapped to `kioskCustomization`
- status reporting enabled for app, software, device settings, memory, and network reports

Only policy metadata and allow/block lists are sent to managed configuration. Student browsing history, private messages, audio, camera, screenshots, and keystrokes are not included.

Android controls are edited only on draft policies. A daily update window uses device-local minutes after midnight and must have different start and end values; a window may cross midnight. Android Management does not provide weekday-specific update windows or kiosk wallpaper controls, and policy restrictions cannot prevent a physical hardware-recovery reset.

## Failure Handling

If Google publish fails, the internal policy remains `PUBLISHED` with `mdmPublishStatus=FAILED` and `mdmPublishError` populated. This keeps the version history deterministic while making the connector failure visible for retry and support workflows.

## References

- Android Management API `enterprises.policies.patch`: https://developers.google.com/android/management/reference/rest/v1/enterprises.policies/patch
- Android Management API dedicated device policies: https://developers.google.com/android/management/policies/dedicated-devices
