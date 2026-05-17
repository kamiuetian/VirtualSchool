# Remote Command Operations

Phase 1 supports tenant-scoped command history and queued remote operations for school-owned Android tablets.

## Supported Commands

- `LOCK`
- `UNLOCK`
- `REQUEST_CHECK_IN`
- `POLICY_REFRESH`
- `SEND_MESSAGE`
- `APP_INSTALL`
- `APP_REMOVE`
- `WIPE` through the dedicated destructive endpoint only

`RETIRE` is reserved in the shared command type set, but is not exposed as a generic Phase 1 endpoint.

## API Endpoints

- `GET /api/v1/tenants/:tenantId/devices/:deviceId/commands`
  - Requires `device:read`.
  - Returns command history for one tenant-owned device.
- `POST /api/v1/tenants/:tenantId/devices/:deviceId/commands`
  - Requires `device:command`.
  - Queues a non-destructive command.
  - Rejects destructive command types.
- `POST /api/v1/tenants/:tenantId/devices/:deviceId/commands/wipe`
  - Requires `device:wipe`.
  - Requires a reason and exact serial-number confirmation.
  - Queues a wipe/reset command with one delivery attempt.
- `POST /api/v1/tenants/:tenantId/devices/:deviceId/commands/claim`
  - Requires `device:command`.
  - Claims queued commands for connector/device dispatch and marks them `DELIVERED`.
- `POST /api/v1/tenants/:tenantId/devices/:deviceId/commands/:commandId/delivery-failures`
  - Requires `device:command`.
  - Requeues the command until `maxAttempts`; then marks it `FAILED`.
- `POST /api/v1/tenants/:tenantId/devices/:deviceId/commands/:commandId/results`
  - Requires `device:command`.
  - Records `EXECUTED` or `FAILED` execution result.

## Status Lifecycle

Normal delivery path:

1. API queues command as `QUEUED`.
2. Connector claims command and status becomes `DELIVERED`.
3. Connector reports execution and status becomes `EXECUTED`.

Failure and expiry path:

1. Delivery failures move `DELIVERED` commands back to `QUEUED` until attempts are exhausted.
2. Exhausted delivery failures become `FAILED`.
3. Commands past `expiresAt` become `EXPIRED`.
4. Execution failures become `FAILED` and require a failure reason.

## Audit Requirements

The API writes audit events for:

- Command queue.
- Delivery retry.
- Delivery failure.
- Execution success.
- Execution failure.
- Expiry.

Destructive wipe commands also capture the actor, reason, command type, expiry, and confirmation outcome.

## Regression Cases

- A support agent can queue `LOCK` but cannot queue `WIPE`.
- A wipe command with the wrong confirmation serial is rejected.
- Queued commands can be claimed and move to `DELIVERED`.
- Delivery failure before max attempts requeues the command.
- Delivery failure at max attempts marks the command `FAILED`.
- Execution success marks command `EXECUTED`.
- Successful `LOCK`, `UNLOCK`, and `WIPE` commands update device status to `LOCKED`, `ONLINE`, and `RETIRED`.
- Expired queued or delivered commands are marked `EXPIRED`.
- Command history never crosses tenant boundaries.
