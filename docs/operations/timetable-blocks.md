# Timetable Blocks

Phase 1 timetable blocks are recurring weekly schedule records that activate a published `TIMETABLE_CLASS` policy for a tenant, grade, or class scope.

## API Surface

- `GET /api/v1/tenants/:tenantId/timetable-blocks`
- `POST /api/v1/tenants/:tenantId/timetable-blocks`
- `PATCH /api/v1/tenants/:tenantId/timetable-blocks/:blockId`
- `POST /api/v1/tenants/:tenantId/timetable-blocks/:blockId/deactivate`
- `GET /api/v1/tenants/:tenantId/timetable-blocks/active?deviceId=:deviceId&at=:isoDate`

Create and update operations require `policy:manage`. Listing requires `tenant:read`. Active resolution requires `device:read`.

## Scheduling Rules

- `dayOfWeek` uses ISO weekdays: Monday is `1`, Sunday is `7`.
- `startMinute` and `endMinute` are minutes after midnight in the block timezone.
- `endMinute` is exclusive and must be greater than `startMinute`.
- A block may set `timezone`; otherwise the tenant timezone is used.
- `effectiveFrom` and `effectiveUntil` are optional absolute UTC date boundaries.
- Active blocks cannot overlap for the same tenant, day, scope, and scope target.
- Timetable blocks can only reference published policies whose rules use `TIMETABLE_CLASS`.

## Resolution

The active timetable lookup evaluates tenant, grade, and class matches for a device. When multiple blocks match the same local time, the most specific scope wins:

1. Class
2. Grade
3. Tenant

Ties use the higher policy version, then the most recently created block. The response includes the active block, active policy, evaluated matching blocks, timezone, resolved timestamp, and explanation.

## Audit Events

The API records these audit actions:

- `timetable_block.create`
- `timetable_block.update`
- `timetable_block.deactivate`

Each event stores actor metadata when provided, object id, old/new values where applicable, reason, tenant id, and outcome.
