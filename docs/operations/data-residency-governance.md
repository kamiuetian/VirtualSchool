# Data residency and multi-region governance

Tenant administrators select one supported storage region (`PK`, `EU`, `US`, or `APAC`) and an allowlist of operating-region codes from **Tenants → Data residency and regions**. Region codes are uppercase organizational boundaries such as `NORTH` or `SOUTH`; each campus must use an allowed code and the tenant's storage region.

The API rejects a governance change while an existing campus would fall outside the new operating-region allowlist or storage region. This prevents an administrative edit from silently moving local school data across a declared boundary. Every governance update and campus creation is tenant-scoped and audited. Changing the displayed setting does not migrate infrastructure; operators must complete an approved infrastructure migration first, update campus placement, and then change the declaration.

Authorized report users can call `GET /api/v1/tenants/{tenantId}/data-governance`. The response contains aggregate campus, student, class, and device counts by region. It never returns regional record-level data, and the normal tenant authorization guard prevents cross-tenant roll-up access.

Before enabling a new region:

1. Confirm the deployment has storage, backups, logs, and connector processing in the declared region.
2. Add the operating-region code to the tenant allowlist.
3. Create or migrate campuses into that code.
4. Review the regional governance roll-up and audit event.
