# App Deployment Commands

Phase 1 app deployment queues device-scoped domain commands from the tenant app catalog.

## API

`POST /api/v1/tenants/:tenantId/apps/:appId/deployments`

Required permission: `device:command`

Request fields:

- `action`: `INSTALL` or `REMOVE`
- `scope`: `TENANT`, `GRADE`, `CLASS`, `STUDENT`, or `DEVICE`
- `scopeId`: required unless `scope` is `TENANT`
- `reason`: optional audit reason
- `ttlMinutes`: optional command expiry, default `120`
- `maxAttempts`: optional retry cap, default `3`

The response includes targeted device count, queued command count, skipped device count, and command ids.

## Behavior

- `INSTALL` is allowed only for apps with `approvalStatus=APPROVED`.
- `REMOVE` can be queued for deprecated or blocked apps.
- Matching devices exclude retired and failed-enrollment devices.
- Each matching device receives one queued command:
  - `APP_INSTALL` for install deployments
  - `APP_REMOVE` for remove deployments
- Command payload includes app id, package id, app name, install rules, action, scope, and source.
- `app_deployment.queue` audit events capture actor, package, scope, command type, and queued count.

## Android Management API Boundary

Android Management API does not install or remove apps through `devices.issueCommand`. App install state is enforced by publishing policy `applications` through `enterprises.policies.patch`.

For that reason, connector dispatch only sends direct Android MDM commands such as `LOCK` and `WIPE` to `issueCommand`. App deployment commands remain available for device-side claim, app deployment status tracking, and policy refresh workflows. A later worker can combine app deployment with policy republish and affected-device `POLICY_REFRESH` commands.
