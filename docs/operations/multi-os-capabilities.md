# Multi-OS capability catalog and unified inventory

The device inventory now uses a common platform, provider, OS version, enrollment type, ownership type, compliance, and control-support shape. Existing Android Management devices are represented as Android, with fully managed enrollment when an enrollment identity is present. This preserves existing device and command APIs while allowing additional providers to populate the same model later.

Authorized device readers can use:

- `GET /api/v1/tenants/:tenantId/device-capabilities` for the management capability catalog.
- `GET /api/v1/tenants/:tenantId/devices` for unified inventory.
- Inventory query filters: `platform`, `provider`, `compliance`, `enrollmentType`, and `ownershipType`.

The catalog describes support by OS, minimum version where applicable, enrollment type, and ownership. `PARTIAL` means a provider integration or enrollment prerequisite is required; it must not be presented as active enforcement. `UNSUPPORTED` controls are returned explicitly on device summaries so operators do not mistake missing enforcement for compliance.

## Unified compliance and OS lifecycle

Each inventory record includes a `complianceAssessment` with a 0–100 score, grade, plain-language reasons, and a capability note. The score uses only observable controls for that platform; catalogued unsupported controls are explicitly excluded rather than silently counted as failures. Android lifecycle governance currently supports Android 12 and later and recommends Android 14 or later. Older releases are marked `UNSUPPORTED`, receive an update recommendation, and carry an operator-visible restriction to block new policy publication and sensitive remote operations until updated.

Operators can filter `/api/v1/tenants/:tenantId/devices` by `osLifecycle`. The device inventory screen exposes the same filter, score explanation, lifecycle state, recommendation, and restrictions. Tenant-scoped device inventory JSON and CSV reports include the compliance score, grade, lifecycle state, update recommendation, and restrictions for audit and remediation workflows.

All endpoints retain tenant scoping and require `device:read`. The catalog contains product capability metadata only and has no credentials or tenant data.
