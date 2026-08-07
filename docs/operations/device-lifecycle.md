# Device lifecycle and assignment history

Device assignment changes require an operator reason. Each change closes the current `DeviceAssignment` record and creates a new tenant-scoped record, preserving prior student, class, and branch ownership for audit and support review.

Authorized enrollment administrators can use `POST /api/v1/tenants/:tenantId/devices/:deviceId/unenroll` to remove connector enrollment identity for reprovisioning, or `POST /api/v1/tenants/:tenantId/devices/:deviceId/retire` to permanently retire an asset. Both operations require a reason, close the active assignment, clear current ownership and policy version, and write both a lifecycle record and an audit event. Unenrolled devices return to quarantine (`PENDING`); retired devices remain `RETIRED` and cannot be reassigned.

`GET /api/v1/tenants/:tenantId/devices/:deviceId/history` returns assignment and lifecycle history only after tenant-scoped device lookup. Active policy resolution rejects retired devices, so launcher/browser policy payloads are no longer delivered after retirement.
