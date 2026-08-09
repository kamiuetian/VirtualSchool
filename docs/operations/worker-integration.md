# Worker Integration

Phase 1 runs background work from `apps/worker` using BullMQ and Redis. The worker owns jobs that should not depend on an admin request staying open.

## Queue

Queue name: `virtual-school-background`

Scheduled jobs:

- `commands.dispatch`: expires overdue commands and optionally dispatches direct connector commands.
- `alerts.offline-scan`: creates or refreshes `DEVICE_OFFLINE` alerts for stale devices.
- `notifications.dispatch`: sends enabled tenant alerts to configured email recipients and records each outcome.
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
- `MDM_CONNECTOR_MODE`: defaults to the safe local `stub`; set to `android-management` for production dispatch.
- `ANDROID_MANAGEMENT_ENTERPRISE_ID` (or legacy `ANDROID_ENTERPRISE_ID`): enterprise identity used when a device only has an enrollment id.
- `ANDROID_MANAGEMENT_API_BASE_URL`: optional Android Management API base URL override, primarily for controlled integration testing.
- Google application-default credentials: configure workload identity or `GOOGLE_APPLICATION_CREDENTIALS` with the Android Management API scope in production.
- `WORKER_OFFLINE_SCAN_INTERVAL_MS`: offline scan interval, default `300000`.
- `WORKER_OFFLINE_AFTER_MINUTES`: offline alert threshold, default `60`.
- `WORKER_NOTIFICATION_INTERVAL_MS`: email dispatch interval, default `60000`.

- `WORKER_ENGAGEMENT_SCAN_INTERVAL_MS`: interval for explainable seven-day engagement-risk evaluation and weekly summary generation, default `3600000`. Guardian summaries remain disabled until a tenant explicitly enables them; generated guardian messages contain only linked learners and the rule evidence that triggered the summary.
- `WORKER_AUTOMATION_INTERVAL_MS`: interval for evaluating enabled tenant automation rules, default `60000`. Rules are restricted to device-offline or repeated-policy-failure triggers and notification or internal-support-item actions. Each rule/target/time-window execution is uniquely recorded to suppress duplicate actions, and automation output is never accepted as trigger evidence.
- `WORKER_NOTIFICATION_BATCH_SIZE`: maximum alerts evaluated per tenant and run, default `100`.
- `EMAIL_DELIVERY_WEBHOOK_URL`: HTTPS endpoint for the configured email provider adapter. If absent, attempts fail safely without sending.
- `EMAIL_DELIVERY_WEBHOOK_TOKEN`: optional bearer token for the email provider adapter.
- `EMAIL_FROM`: sender address included in the provider request, default `alerts@virtualschool.local`.
- `EMAIL_DELIVERY_TIMEOUT_MS`: provider request timeout, default `10000`.
- `WEBHOOK_SIGNING_SECRETS_JSON`: runtime JSON map from endpoint secret references to signing secrets. Supply it from the deployment secret manager; do not commit values.
- `WORKER_WEBHOOK_INTERVAL_MS`: signed webhook capture and dispatch interval, default `30000`.
- `WORKER_WEBHOOK_BATCH_SIZE`: maximum due deliveries processed per tenant and run, default `100`.
- `WORKER_WEBHOOK_CAPTURE_BATCH_SIZE`: maximum eligible audit events captured per tenant and run, default `250`.
- `WEBHOOK_DELIVERY_TIMEOUT_MS`: outbound webhook request timeout, default `10000`.
- `WORKER_RETENTION_DRY_RUN_INTERVAL_MS`: retention dry-run interval, default `86400000`.
- `WORKER_RETENTION_APPLY_ENABLED`: set to `true` to schedule deletion jobs.
- `WORKER_RETENTION_APPLY_INTERVAL_MS`: retention apply interval, default `86400000`.

## Command Processing

The command job always expires overdue queued or delivered commands. Expired `POLICY_REFRESH`, `APP_INSTALL`, and `APP_REMOVE` commands create deployment failure alerts with worker metadata.

Direct MDM command dispatch is opt-in with `WORKER_MDM_DISPATCH_ENABLED=true`. The default stub mode marks `LOCK` and `WIPE` commands delivered with a `stub:` connector command id and never contacts Google. With `MDM_CONNECTOR_MODE=android-management`, the worker resolves the device resource name, obtains application-default Google credentials, and calls `enterprises.devices.issueCommand`.

Successful connector operations are recorded on the command and in its dispatch audit event. Authentication, network, and Google API errors are retryable: the command returns to `QUEUED` until `maxAttempts` is reached or it expires. Missing Android device identity is a permanent failure and is not retried. Keep API-driven dispatch disabled when worker dispatch is enabled so two processes do not claim the same queued command.

## Alert Email Delivery

Admins configure normalized recipients, alert categories, offline and repeated-enrollment thresholds, and the deduplication window on the Alerts page. The worker evaluates open offline, policy-deployment, app-deployment, lost-device, and repeated-enrollment alerts. A unique alert/recipient/channel delivery record prevents duplicate email, caps failed attempts at three, and preserves the provider response or failure reason. Every attempt also creates a tenant-scoped audit event.

The provider webhook receives JSON containing `to`, `from`, `subject`, `text`, `tenantId`, and `alertId`. It should return any 2xx response; an optional JSON `id` is retained as the provider message id. Store the bearer token in a secret manager and never commit it.

## Signed Education Webhooks

Tenant administrators configure HTTPS endpoints, subscribed event types, a bounded attempt count, and an opaque signing-secret reference on the Integrations page. Supported Phase 2 event types are `device.offline`, `mode.changed`, `policy.failed`, `exam.started`, `support_ticket.created`, and `lost_device.reported`. Disabling an endpoint stops capture and delivery without deleting its log. Rotating a secret changes the reference and increments the signature version while preserving prior delivery evidence.

The worker converts the corresponding durable audit events into a privacy-limited outbox event. Each endpoint receives a versioned JSON envelope containing `apiVersion`, stable event `id`, `delivery` attempt metadata, `occurredAt`, the backward-compatible `tenantId`, structured `tenant` and `object` metadata, `type`, and `data`. It signs the exact UTF-8 request body with HMAC-SHA256 over `<timestamp>.<body>` and sends these headers:

- `X-VirtualSchool-Event-Id`: stable event UUID for idempotency.
- `X-VirtualSchool-Delivery-Id`: stable endpoint-delivery UUID for attempt correlation.
- `X-VirtualSchool-Timestamp`: Unix time in seconds.
- `X-VirtualSchool-Signature`: `v1=<lowercase hex HMAC>`.
- `X-VirtualSchool-Signature-Version`: endpoint secret version.

Receivers should reject timestamps outside a five-minute tolerance, deduplicate event IDs, and compare the expected signature in constant time. Return any 2xx status to acknowledge delivery. HTTP 408, 429, 5xx, and network failures retry with exponential delay up to the configured maximum; other 4xx responses and missing runtime secrets fail permanently. Delivery inspection includes attempt timing, response status, failure reason, signature timestamp, and event metadata. An administrator may requeue only a failed delivery against an enabled endpoint, must supply a reason, and creates immutable audit evidence; a successful or pending delivery cannot be replayed through this control.

## Retention Safety

The worker schedules dry-runs by default. Retention apply jobs are not scheduled unless `WORKER_RETENTION_APPLY_ENABLED=true`, because apply jobs delete old diagnostics, resolved alerts, completed commands, resolved support notes, and optionally audit records according to tenant retention settings.

## Regression Coverage

Worker regression tests cover:

- overdue deployment commands expire and create deployment failure alerts
- production connector acceptance and retry requeueing
- safe stub fallback when production mode is not configured
- stale devices create offline alerts and audit records
- scheduled retention dry-runs create retention run records
- enabled alerts send once per recipient and delivery outcomes are retained
