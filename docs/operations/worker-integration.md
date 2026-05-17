# Worker Integration

Phase 1 runs background work from `apps/worker` using BullMQ and Redis. The worker owns jobs that should not depend on an admin request staying open.

## Queue

Queue name: `virtual-school-background`

Scheduled jobs:

- `commands.dispatch`: expires overdue commands and optionally dispatches direct connector commands.
- `alerts.offline-scan`: creates or refreshes `DEVICE_OFFLINE` alerts for stale devices.
- `retention.dry-run`: records scheduled data retention counts.
- `retention.apply`: applies data retention cleanup only when explicitly enabled.

## Configuration

- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string, default `redis://localhost:6379`.
- `WORKER_QUEUE_ENABLED`: set to `false` to disable BullMQ startup.
- `WORKER_CONCURRENCY`: BullMQ worker concurrency, default `3`.
- `WORKER_COMMAND_INTERVAL_MS`: command job interval, default `60000`.
- `WORKER_COMMAND_DISPATCH_LIMIT`: maximum direct connector commands per tenant per run, default `25`.
- `WORKER_MDM_DISPATCH_ENABLED`: set to `true` to allow worker-side direct command dispatch.
- `WORKER_OFFLINE_SCAN_INTERVAL_MS`: offline scan interval, default `300000`.
- `WORKER_OFFLINE_AFTER_MINUTES`: offline alert threshold, default `60`.
- `WORKER_RETENTION_DRY_RUN_INTERVAL_MS`: retention dry-run interval, default `86400000`.
- `WORKER_RETENTION_APPLY_ENABLED`: set to `true` to schedule deletion jobs.
- `WORKER_RETENTION_APPLY_INTERVAL_MS`: retention apply interval, default `86400000`.

## Command Processing

The command job always expires overdue queued or delivered commands. Expired `POLICY_REFRESH`, `APP_INSTALL`, and `APP_REMOVE` commands create deployment failure alerts with worker metadata.

Direct MDM command dispatch is opt-in with `WORKER_MDM_DISPATCH_ENABLED=true`. In stub mode, the worker marks `LOCK` and `WIPE` commands delivered with a `stub:` connector command id. If `MDM_CONNECTOR_MODE=android-management`, the worker currently skips direct dispatch and leaves the API connector dispatch endpoint as the source of truth until Android Management worker credentials and adapter behavior are configured.

## Retention Safety

The worker schedules dry-runs by default. Retention apply jobs are not scheduled unless `WORKER_RETENTION_APPLY_ENABLED=true`, because apply jobs delete old diagnostics, resolved alerts, completed commands, resolved support notes, and optionally audit records according to tenant retention settings.

## Regression Coverage

Worker regression tests cover:

- overdue deployment commands expire and create deployment failure alerts
- stale devices create offline alerts and audit records
- scheduled retention dry-runs create retention run records
