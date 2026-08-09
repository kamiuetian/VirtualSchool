# Compliance evidence packs

Authorized users with `audit:read` can generate and download immutable tenant-scoped evidence snapshots from the Security and privacy center.

Each pack has a required name and a historical window of at most 366 days. The creator selects one or more of audit logs, access reviews, retention settings, the controls summary, and policy exports. Generation copies the selected records into a JSON artifact, stores that artifact once, and records its SHA-256 checksum. Later downloads return the stored snapshot rather than rebuilding it from current data.

API operations:

- `GET /api/v1/tenants/:tenantId/privacy/evidence-packs`
- `POST /api/v1/tenants/:tenantId/privacy/evidence-packs`
- `GET /api/v1/tenants/:tenantId/privacy/evidence-packs/:packId/download`

Pack creation is audited as `compliance_evidence_pack.create`. There are intentionally no update or delete operations. Both list and download queries include the authenticated tenant route scope, and the normal tenant guard and `audit:read` permission apply. The checksum covers the artifact object exactly as persisted and can be used to verify that downloaded evidence has not changed.

The admin portal downloads through its authenticated `/privacy/evidence-pack.json` route so API credentials are never placed in a browser URL.
