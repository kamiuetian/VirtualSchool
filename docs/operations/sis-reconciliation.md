# SIS reconciliation operations

SIS integrations use tenant-scoped, idempotent ID mappings. The API accepts identifiers only; it does not accept credentials or silently create roster records.

## Endpoints

- `POST /api/v1/tenants/{tenantId}/integrations/sis/reconciliations` accepts a `source` and 1–500 `records`. Each record contains `objectType` (`STUDENT`, `CLASS`, `TEACHER`, `GUARDIAN`, or `ENROLLMENT`), `localId`, and `externalId`. Enrollment local IDs use `classId:studentId`.
- `GET /api/v1/tenants/{tenantId}/integrations/sis/operations` returns the latest 50 runs, per-record outcomes, counts, retry lineage, and the most recent successful completion.
- `POST /api/v1/tenants/{tenantId}/integrations/sis/reconciliations/{runId}/retry` retries only failed records.

All endpoints require `roster:manage`. Local records and retries are resolved inside the route tenant, external IDs are unique per tenant/source/object type, and every run is audited. A batch can be `SUCCEEDED`, `PARTIAL`, or `FAILED`; callers should inspect record outcomes rather than retrying successful records.
