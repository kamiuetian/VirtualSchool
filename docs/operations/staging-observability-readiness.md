# Staging observability and readiness

This runbook defines the minimum evidence required before declaring the staging platform operationally ready. It covers service health, structured logs, CloudWatch alarms, notification delivery, and recovery checks without exposing tenant or credential data.

## Health signals

The API exposes public health probes beneath the existing API prefix:

- `GET /api/v1/health` and `GET /api/v1/health/live` confirm that the process can serve requests. Load-balancer liveness checks should use `/live`.
- `GET /api/v1/health/ready` runs `SELECT 1` against PostgreSQL and returns HTTP 503 when the database is unavailable. Deployment readiness checks should use `/ready`.

Do not include credentials, tenant identifiers, database error details, or stack traces in health responses. Redis is a worker dependency rather than an API request-path dependency and is monitored through ElastiCache metrics and worker error logs.

## Logs, dashboard, and alerts

API and worker NestJS logs are JSON lines with `timestamp`, `level`, `service`, `message`, and optional `context` and `error` fields. ECS must use the Terraform-created `/ecs/virtual-school-staging/<workload>` log groups. CloudWatch metric filters count records whose `level` is `error`.

The `virtual-school-staging-operations` dashboard displays PostgreSQL CPU, connections, and free storage; Redis CPU, connections, and free memory; and per-workload structured error counts. The encrypted `virtual-school-staging-operational-alerts` SNS topic receives alarm and recovery notifications for:

- sustained database CPU above 80%;
- database free storage below 5 GiB;
- sustained Redis engine CPU above 70%;
- the configured application error count within five minutes.

Set `operational_alert_email` in the non-secret staging Terraform variables when email delivery is required, then confirm the AWS subscription. On every staging rollout, verify the dashboard has current data and use a temporary test alarm or the SNS publish command to verify the notification route. Record the date, responder, alarm name, delivery result, and linked incident in the release evidence.

## Alert response

1. Acknowledge the notification and identify the affected service and first alarm timestamp.
2. Check the operations dashboard and the matching workload log group. Search by structured `level`, `service`, and `context`; never paste secret values or student data into incident notes.
3. For database or Redis pressure, stop nonessential imports/exports and worker concurrency increases before considering capacity changes.
4. For application errors, correlate the deployment revision and audit events, then roll back through the approved deployment workflow if the release is responsible.
5. Confirm the alarm returns to `OK`, document the mitigation, and create follow-up work for recurring causes.

## Backup and recovery evidence

Terraform enforces seven days of RDS point-in-time recovery, seven Redis snapshots, database deletion protection and a required final snapshot. S3 application buckets are encrypted and versioned.

Before each pilot and at least monthly during staging use:

1. Verify RDS `BackupRetentionPeriod` is at least seven and `LatestRestorableTime` is current.
2. Verify Redis `SnapshotRetentionLimit` is at least seven and a recent automatic snapshot exists.
3. Restore PostgreSQL to a new isolated staging instance at a selected point in time. Do not overwrite the active database.
4. Run Prisma validation/migrations as appropriate, connect using an ephemeral approved credential path, and verify representative tenant counts without exporting personal data.
5. Restore a Redis snapshot to an isolated replication group and verify connectivity; queued jobs need not be replayed into active staging.
6. Verify an earlier version of a non-sensitive test object can be read from each versioned S3 bucket.
7. Delete isolated drill resources only after identifiers and evidence are reviewed. Record recovery point, elapsed restore time, validation results, operator, and cleanup confirmation.

A failed or stale backup check blocks promotion. Escalate through `docs/operations/support-escalation.md` and retain the evidence with the release record.

## Release readiness checklist

- Liveness returns HTTP 200 without checking dependencies.
- Readiness returns HTTP 200 with `checks.database=ok`.
- API and worker logs parse as JSON and contain the expected service name.
- CloudWatch dashboard widgets show current data.
- All alarms are `OK` and the SNS notification path has been tested.
- The most recent monthly isolated restore drill passed and cleanup is recorded.
