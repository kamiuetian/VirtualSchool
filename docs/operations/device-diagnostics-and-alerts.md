# Device Diagnostics And Alerts

Phase 1 stores privacy-limited technical diagnostics for school-owned Android tablets and turns actionable health signals into tenant-scoped alerts.

## APIs

- `GET /api/v1/tenants/:tenantId/devices/:deviceId/diagnostics`
- `POST /api/v1/tenants/:tenantId/devices/:deviceId/diagnostics`
- `GET /api/v1/tenants/:tenantId/alerts`
- `POST /api/v1/tenants/:tenantId/alerts/offline-scan`
- `POST /api/v1/tenants/:tenantId/alerts/:alertId/acknowledge`
- `POST /api/v1/tenants/:tenantId/alerts/:alertId/resolve`

Read endpoints require `device:read`. Upload, acknowledge, and resolve endpoints require `device:command`.

## Diagnostic Payload

Supported fields:

- `batteryLevel`
- `storageFreeMb`
- `networkStatus`
- `launcherVersion`
- `browserVersion`
- `mdmPolicyName`
- `policyVersion`
- `health`
- `compliance`
- `details`
- `reportedAt`

The `details` object is for privacy-limited technical state only. It must not include browsing history, private messages, audio, camera data, screenshots, or keystrokes.

## Alert Rules

Diagnostics create or refresh these alerts:

- `BATTERY_LOW`: battery is `20%` or lower. Severity becomes `CRITICAL` at `10%` or lower.
- `STORAGE_LOW`: free storage is `1024 MB` or lower. Severity becomes `CRITICAL` at `256 MB` or lower.
- `DEVICE_NON_COMPLIANT`: compliance value is not `COMPLIANT` or `UNKNOWN`.
- `DEVICE_UNHEALTHY`: health value is not `CHECKED_IN`, `OK`, `HEALTHY`, or `UNKNOWN`.
- `DEVICE_OFFLINE`: offline scan finds a device past the configured check-in threshold.

Recovered diagnostics automatically resolve matching open or acknowledged alerts where safe to do so.

## Audit Events

- `device_diagnostic.upload`
- `device_alert.acknowledge`
- `device_alert.resolve`
- `device_alert.offline_scan`

Alert acknowledgement and resolution record actor id, status transition, reason, and tenant scope.
