# Supportability And Retention

Phase 1 supportability gives school admins, IT admins, and authorized support agents a tenant-scoped way to capture device support context and manage data lifecycle.

## APIs

Support APIs:

- `GET /api/v1/tenants/:tenantId/support/devices/:deviceId/notes`
- `POST /api/v1/tenants/:tenantId/support/devices/:deviceId/notes`
- `PATCH /api/v1/tenants/:tenantId/support/notes/:noteId`
- `GET /api/v1/tenants/:tenantId/support/devices/:deviceId/timeline`

Retention APIs:

- `GET /api/v1/tenants/:tenantId/retention-settings`
- `PATCH /api/v1/tenants/:tenantId/retention-settings`
- `POST /api/v1/tenants/:tenantId/retention-runs/dry-run`
- `POST /api/v1/tenants/:tenantId/retention-runs`

Read endpoints require `device:read` or `tenant:read`. Support note writes require `device:command`. Retention setting changes and retention runs require `tenant:update`.

## Support Notes

Support notes are scoped to one tenant and one device. Each note stores:

- author id and email from the authenticated request
- category: `GENERAL`, `INCIDENT`, `ESCALATION`, `DEPLOYMENT`, `ENROLLMENT`, or `PRIVACY`
- severity: `S1`, `S2`, `S3`, or `S4`
- status: `OPEN`, `IN_PROGRESS`, or `RESOLVED`
- visibility: `INTERNAL` or `SCHOOL`
- pinned flag, note body, optional resolution, and timestamps

Every create and update writes an audit event. Support notes must not contain private messages, screenshots, keystrokes, camera data, microphone data, or browsing history.

## Device Timeline

The support timeline combines:

- support notes
- remote command history
- privacy-limited diagnostics
- device alerts

Events are sorted newest first and include a compact metadata payload for support workflows. Timeline data remains tenant-scoped through the API guard and service queries.

## Retention Defaults

Default tenant settings:

- diagnostics: `90` days
- resolved alerts: `180` days
- completed command history: `365` days
- resolved support notes: `730` days
- export artifacts: `30` days
- audit events: retained indefinitely unless `auditRetentionDays` is explicitly configured

Audit retention cannot be configured below `365` days. Export artifact cleanup is represented in the retention result now, but remains `0` until export artifact persistence is added.

## Retention Runs

Dry runs count eligible records without deleting them. Apply runs delete:

- diagnostics older than the diagnostic cutoff
- resolved alerts older than the resolved-alert cutoff
- completed remote commands with status `EXECUTED`, `FAILED`, or `EXPIRED` older than the command cutoff
- resolved support notes older than the support-note cutoff
- audit events older than the audit cutoff only when audit retention is explicitly configured

Open alerts, queued or delivered commands, unresolved support notes, and current audit events are preserved. Each dry run and apply run stores a `DataRetentionRun` record and writes an audit event.
