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

# Learning-access and device-usage analytics

`GET /api/v1/tenants/{tenantId}/reports/learning-usage` requires `report:export` and accepts `from`, `to`, `classId`, `grade`, `deviceGroup`, and `category` query filters. Dates are tenant-scoped ISO calendar dates, are inclusive, and are limited to a 366-day window. The default window is the latest 30 days.

The report derives participation and missed-session counts from durable attendance records, approved resource launches from teacher-session events, and offline-device counts from current managed-device state. It provides daily trends and breakdowns by class, grade, device group tag, and approved resource category. It does not expose URLs, browsing history, unapproved launches, or student-level activity.
