# Audit And Reporting Operations

Phase 1 exposes tenant-scoped audit search and reporting endpoints for school administrators, IT administrators, and auditors.

## Audit Events

Endpoint:

- `GET /api/v1/tenants/:tenantId/audit-events`

Permission:

- `audit:read`

Filters:

- `action`
- `object`
- `objectId`
- `actorId`
- `outcome`
- `from`
- `to`
- `limit`
- `offset`

Audit search is always tenant-scoped. Cross-tenant audit access is blocked by the global Auth/RBAC guard before the audit service query runs.

## Reports

Endpoints:

- `GET /api/v1/tenants/:tenantId/reports/device-inventory`
- `GET /api/v1/tenants/:tenantId/reports/device-inventory.csv`
- `GET /api/v1/tenants/:tenantId/reports/policy-deployments`
- `GET /api/v1/tenants/:tenantId/reports/app-deployments`

Permission:

- `report:export`

The device inventory CSV export writes a `report.export` audit event with actor id, report name, format, and row count.

## Regression Cases

- Users without `audit:read` cannot list audit events.
- Users without `report:export` cannot access report or export endpoints.
- Audit queries never return another tenant's events.
- Device inventory totals match the returned device rows.
- Device inventory CSV export creates a `report.export` audit event.
- Policy deployment totals match assignment counts.
- App deployment rows show published policies referencing each app package id.
