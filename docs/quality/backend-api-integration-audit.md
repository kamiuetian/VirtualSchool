# Backend API and Admin Integration Audit

Date: 2026-08-07
Scope: NestJS API, worker boundary, and Next.js admin-to-API integration
Auditor constraint: read-only product audit; no product fixes or backlog edits

## Executive summary

The API has broad Phase 1 coverage and a consistent controller-level authorization model. All 114 API tests and all 5 admin unit tests pass. Service code generally includes `tenantId` in child-record lookups, writes important state changes and their audit records in transactions, validates DTOs globally, and keeps the Android Management connector in an explicit stub/configured mode.

This is not yet evidence that every endpoint works against a real database. Docker Desktop was unavailable and neither PostgreSQL nor Redis was listening locally, so live persistence, migration, concurrency, worker, and cross-tenant HTTP tests could not be performed. The existing controller tests mostly verify delegation rather than HTTP status, validation, serialization, or database behavior. The admin Playwright suite uses a mock API rather than NestJS/PostgreSQL and could not be completed in this audit because the default port was occupied by the concurrent UI audit; an isolated-port attempt did not become ready and was terminated without modifying source.

No confirmed P0 issue was found. The most important confirmed design defects are: the admin converts authorization/server failures on reads into empty data (P1 data-integrity/operational ambiguity); bulk CSV actions make independent sequential writes and can leave partial imports (P1); backend endpoints permitted for read-only roles are hidden by stricter frontend permission gates (P2); and mutation errors are thrown as raw response bodies with no structured, safe user-facing error contract (P2).

## Environment and evidence

- Repository: `E:\Projects\VirtualSchool`, current shared worktree on 2026-08-07.
- Runtime: Windows/PowerShell, pnpm workspace, Node processes local only.
- Database/queue: `127.0.0.1:5432` and `:6379` both refused connections. `docker compose ps` failed because the Docker Desktop Linux engine pipe did not exist.
- API live-start attempt: failed before application start because the Codex-bundled pnpm attempted a non-interactive dependency-store migration. No repository files were changed by that attempt.
- API tests: `pnpm --filter @virtual-school/api test` — **33 files, 114/114 passing**.
- Admin tests: `pnpm --filter @virtual-school/admin test` — **1 file, 5/5 passing**.
- Admin Playwright: default run blocked because `127.0.0.1:4100` was already occupied; isolated `3300/4200` run did not report readiness and was terminated. Existing tests target `tests/mock-api.mjs`, not the real API.
- Static evidence reviewed: all 15 controllers, auth guard/service, service tenant filters, DTO validation, admin `lib/api.ts`, `lib/actions.ts`, report download routes, Playwright config/mock, Prisma schema/migrations, and worker/MDM tests.

Result legend: **UT pass** = covered by passing unit/controller/service tests; **static pass** = route/auth/tenant query reviewed but not live; **gap** = no meaningful endpoint-level test found; **external** = requires a real provider/worker or unavailable infrastructure.

## Endpoint coverage matrix

All non-health operations require authentication. “Roles” is expressed as the enforced permission because roles are centrally mapped to permissions; this avoids duplicating a role matrix that can change independently.

| Method and path (prefix `/api/v1`)                                                                                                                                           | Auth / permission                          | Result                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| GET `/health`; GET `/health/live`; GET `/health/ready`                                                                                                                       | Public                                     | UT pass (3); readiness DB failure/success mocked; live HTTP not run               |
| GET `/tenants`; GET `/tenants/:tenantId`; GET `/tenants/:tenantId/branches`; GET `/tenants/:tenantId/onboarding-checklist`                                                   | `tenant:read`                              | UT/static pass; list is scoped using authenticated `tenantIds`                    |
| POST `/tenants`                                                                                                                                                              | `tenant:create`                            | UT pass; persistence/audit not live-tested                                        |
| PATCH `/tenants/:tenantId`; POST `/tenants/:tenantId/branches`                                                                                                               | `tenant:update`                            | UT/static pass; transactional audit present                                       |
| GET `/tenants/:tenantId/students`; GET `/tenants/:tenantId/classes`                                                                                                          | `tenant:read`                              | service UT/static pass                                                            |
| POST `/tenants/:tenantId/students`                                                                                                                                           | `roster:manage`                            | UT pass; duplicate conflict covered at service level                              |
| POST `/tenants/:tenantId/classes`; POST `/tenants/:tenantId/classes/:classId/students/:studentId`                                                                            | `class:manage`                             | service UT/static pass                                                            |
| POST `/tenants/:tenantId/roster-imports/preview`; GET `/roster-imports/:importId`; POST `/roster-imports/:importId/commit`; GET `/roster-imports/:importId/error-report.csv` | `roster:manage`                            | UT pass for preview/commit/tenant lookup; CSV HTTP headers/export not live-tested |
| GET/POST `/tenants/:tenantId/enrollment-batches`                                                                                                                             | read=`device:read`, create=`device:enroll` | UT/static pass                                                                    |
| GET `/tenants/:tenantId/devices`                                                                                                                                             | `device:read`                              | service UT/static pass                                                            |
| POST `/tenants/:tenantId/devices/check-ins`; POST `/devices/:deviceId/assignments`                                                                                           | `device:enroll`                            | UT pass; idempotent check-in path tested in service                               |
| GET/POST `/tenants/:tenantId/devices/:deviceId/diagnostics`                                                                                                                  | GET `device:read`; POST `device:command`   | UT/static pass; no real device producer                                           |
| GET `/tenants/:tenantId/alerts`; POST `/alerts/offline-scan`                                                                                                                 | `device:read`                              | UT/static pass                                                                    |
| POST `/tenants/:tenantId/alerts/:alertId/acknowledge`; POST `/resolve`                                                                                                       | `device:command`                           | UT pass; tenant-scoped lookup                                                     |
| GET `/tenants/:tenantId/apps`                                                                                                                                                | `tenant:read`                              | UT/static pass                                                                    |
| POST `/tenants/:tenantId/apps`; PATCH `/apps/:appId`                                                                                                                         | `policy:manage`                            | UT pass; duplicate package handling service-tested                                |
| POST `/tenants/:tenantId/apps/:appId/deployments`                                                                                                                            | `device:command`                           | UT pass; queues commands, worker boundary external                                |
| GET `/tenants/:tenantId/policies`; GET `/policies/assignments`; GET `/policies/:policyId/versions`                                                                           | `tenant:read`                              | UT/static pass                                                                    |
| GET `/policies/devices/:deviceId/active`; GET `/payload`                                                                                                                     | `device:read`                              | service UT/static pass                                                            |
| POST `/tenants/:tenantId/policies`; POST `/starter-templates`; POST `/:policyId/publish`; POST `/:policyId/assignments`                                                      | `policy:manage`                            | UT pass; assignment scope checks are tenant-aware                                 |
| GET `/tenants/:tenantId/timetable-blocks`                                                                                                                                    | `tenant:read`                              | UT/static pass                                                                    |
| GET `/tenants/:tenantId/timetable-blocks/active`                                                                                                                             | `device:read`                              | service UT/static pass                                                            |
| POST `/timetable-blocks`; PATCH `/timetable-blocks/:blockId`; POST `/:blockId/deactivate`                                                                                    | `policy:manage`                            | UT pass; overlap and tenant checks service-tested                                 |
| GET `/tenants/:tenantId/devices/:deviceId/commands`                                                                                                                          | `device:read`                              | UT/static pass                                                                    |
| POST `/commands`; POST `/commands/claim`; POST `/:commandId/delivery-failures`; POST `/:commandId/results`                                                                   | `device:command`                           | UT pass; lifecycle/retry/idempotency service-tested; real worker external         |
| POST `/tenants/:tenantId/devices/:deviceId/commands/wipe`                                                                                                                    | `device:wipe`                              | UT pass; confirmation logic tested; real device external                          |
| POST `/tenants/:tenantId/command-dispatch-runs`                                                                                                                              | `device:command`                           | UT pass; stub mapper covered; configured Google API external                      |
| GET `/tenants/:tenantId/reports/device-inventory`; GET `/device-inventory.csv`                                                                                               | `report:export`                            | UT pass; CSV byte/content-disposition not live-tested                             |
| GET `/tenants/:tenantId/reports/policy-deployments`; GET `/app-deployments`                                                                                                  | `report:export`                            | UT pass                                                                           |
| GET `/tenants/:tenantId/billing/subscription`; GET `/billing/usage`                                                                                                          | `billing:read`                             | UT pass                                                                           |
| PATCH `/tenants/:tenantId/billing/subscription`                                                                                                                              | `billing:manage`                           | UT pass; transactional tenant plan sync present                                   |
| GET `/tenants/:tenantId/audit-events`                                                                                                                                        | `audit:read`                               | UT pass; pagination/filter query behavior not live-tested                         |
| GET `/tenants/:tenantId/users`                                                                                                                                               | `tenant:read`                              | UT/static pass                                                                    |
| POST `/users/invitations`; PATCH `/users/:userId/role`                                                                                                                       | `user:invite`                              | UT pass; no Auth0 invitation/provider integration demonstrated                    |
| POST `/users/:userId/suspend`; POST `/deactivate`; POST `/reactivate`; POST `/force-logout`; PATCH `/mfa`                                                                    | `user:suspend`                             | UT pass; stored-user revocation path unit-tested                                  |
| GET/POST `/tenants/:tenantId/support/devices/:deviceId/notes`; GET `/timeline`                                                                                               | GET `device:read`; POST `device:command`   | service/static pass; controller has no dedicated test file                        |
| PATCH `/tenants/:tenantId/support/notes/:noteId`                                                                                                                             | `device:command`                           | service/static pass                                                               |
| GET `/tenants/:tenantId/retention-settings`                                                                                                                                  | `tenant:read`                              | service/static pass                                                               |
| PATCH `/retention-settings`; POST `/retention-runs/dry-run`; POST `/retention-runs`                                                                                          | `tenant:update`                            | service UT/static pass; destructive retention not integration-tested              |

### Coverage conclusion

The route inventory totals **68 operations**. Every route has an explicit public marker or permission decorator. All tenant-prefixed routes are additionally checked by the global guard against the caller's tenant claims. Static review found tenant-qualified `findFirst/findMany` checks for child resources in the major services. However, “all endpoints tested” cannot honestly be claimed: the repository has no full HTTP/database contract suite, and the unavailable local dependencies prevented building one during this read-only parallel audit.

## Frontend integration mapping

| Admin surface      | Backend integration                                                                                                                                        | Assessment                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Global page loader | `/tenants`, then 16 parallel tenant reads (onboarding, devices, reports, alerts, enrollment, policies, apps, roster, users, timetable, retention, billing) | Paths exist. Reads timeout at 1.8 s and collapse every non-2xx into `null`/empty plus one page-wide `connectionIssue`.   |
| Tenants/staff      | tenant create/profile/branch; invite, role, lifecycle, MFA                                                                                                 | Paths and frontend permission checks map to backend. Mutations have no typed error/result contract.                      |
| Roster             | student/class create; CSV preview/get/commit/error download                                                                                                | Paths map. Browser mock covers representative create/preview; bulk class creation is frontend fan-out, not an API batch. |
| Enrollment/devices | batch create/list, assignment, command/wipe, diagnostics/command reads                                                                                     | Paths map. Device check-in, claim, result, and diagnostic ingestion are device/worker-only and have no admin caller.     |
| Policies/timetable | starter/create/publish/assign and timetable create/deactivate                                                                                              | Paths map. PATCH timetable and create arbitrary policy have no current admin action despite API availability.            |
| Apps               | create/bulk create/deploy                                                                                                                                  | Paths map. PATCH app is not exposed in admin.                                                                            |
| Alerts             | list/offline scan/acknowledge/resolve                                                                                                                      | Paths map, but offline scan frontend permission is stricter than backend (see BAI-03).                                   |
| Reports/billing    | report reads and CSV proxy; billing read/update                                                                                                            | Paths map; proxy passes upstream error status/body through.                                                              |
| Support/retention  | note list/create/update/timeline; settings and runs                                                                                                        | Paths map; apply retention is a direct destructive mutation with only server-rendered form flow.                         |
| Audit              | API endpoint exists                                                                                                                                        | No audit-events request or dedicated audit view was found in `getAdminData` or actions.                                  |
| Dispatch           | command-dispatch-run endpoint exists                                                                                                                       | No admin caller; intended operational/worker boundary.                                                                   |

Representative Playwright tests assert five admin mutation request paths (student, roster preview, enrollment batch, policy assignment, device command) against a mock. They do not verify the real Nest validation/auth/database response, empty/error states, 401/403 behavior, stale IDs, CSV response correctness, or worker side effects.

## Findings

### BAI-01 — P1 — Read failures are rendered as legitimate empty/null business data

**Affected:** admin data layer; likely owner: Admin Platform.
**Evidence:** `apps/admin/lib/api.ts`, `apiGet`, catches network errors and maps every non-2xx (including 401, 403, 404, 429, and 500) to `{data:null, failed:true}`. `getAdminData` then substitutes `[]`/`null` for each dataset and exposes only a single boolean.

**Reproduction:** configure the API to return 403 for `/tenants/:id/devices` or stop the API; load Devices. Inspect `getAdminData`: the caller receives `devices: []`, indistinguishable in shape from a school with no devices, with only a generic connection flag shared across all 16 requests.

**Expected:** preserve status/category per resource; authorization failure should lead to an access/session path, server/network failure to a retryable error, and only an actual 200 empty array to an empty-state UI.
**Actual:** operational/auth failures become empty business state.
**Risk:** operators can make decisions from incomplete dashboards; expired credentials look like deleted/missing records.

### BAI-02 — P1 — Frontend bulk imports are non-atomic and silently permit partial completion

**Affected:** staff, class, app, and device-assignment bulk flows; likely owners: Admin + respective API modules.
**Evidence:** `bulkInviteStaffAction`, `bulkCreateClassesAction`, `bulkCreateAppsAction`, and `bulkAssignDevicesAction` loop over CSV rows and call one API mutation at a time. There is no batch id, idempotency key, rollback, or per-row result report.

**Reproduction:** submit a three-row CSV where row 2 is invalid or duplicate. Row 1 persists; row 2 throws; row 3 is never attempted. Retry can then conflict on row 1.
**Expected:** preview plus atomic commit, or an idempotent batch API returning a durable per-row outcome.
**Actual:** partial state and ambiguous retry behavior.
**Risk:** roster-adjacent operational data diverges from the source CSV and requires manual reconciliation.

### BAI-03 — P2 — Frontend permission gates disagree with backend read permissions

**Affected:** policy, app, enrollment, timetable, roster visibility and offline-alert scanning; likely owner: Admin/Auth.
**Evidence:** backend allows policy/app/timetable lists with `tenant:read` and enrollment batches with `device:read`; `getAdminData` only loads these for `policy:manage` or `device:enroll`. Backend offline scan requires `device:read`, while `scanOfflineAlertsAction` requires `device:command`.

**Reproduction:** sign in with a role that has `tenant:read`/`device:read` but not manage/enroll/command; call the backend successfully, then load the corresponding admin surface and observe skipped/empty data or absent action.
**Expected:** UI visibility mirrors backend permissions, with mutation controls separately gated.
**Actual:** authorized readers cannot see data the API explicitly permits.
**Risk:** inconsistent least-privilege roles and confusing support escalations.

### BAI-04 — P2 — Mutation error handling exposes raw upstream bodies and has no usable form-error contract

**Affected:** all admin server actions; likely owner: Admin Platform/API Platform.
**Evidence:** `adminApiJsonMutation` reads the complete response text and throws `new Error(text)`. Actions return `void` and do not translate validation fields, conflict codes, authorization expiry, rate limits, or safe request IDs into a UI state.

**Reproduction:** submit malformed/duplicate input so Nest returns a JSON error body. The server action throws the serialized body rather than a typed result; depending on Next mode, this becomes a generic error boundary or developer error text.
**Expected:** stable API error envelope, server-side sanitization/log correlation, and field/global errors rendered near the form.
**Actual:** raw body becomes an exception string; users cannot correct reliably and internal details may be surfaced.
**Security:** current Nest errors appear modest, but this pattern will expose any future upstream body containing implementation detail.

### BAI-05 — P2 — There is no real API/admin contract test layer

**Affected:** release confidence; likely owners: QA/API/Admin.
**Evidence:** controller tests call controller methods with mocked services; admin Playwright starts `tests/mock-api.mjs`; no Supertest/Nest HTTP suite or Playwright setup using migrated PostgreSQL was found.

**Reproduction:** change a DTO constraint/status code/serialized field in Nest without changing the mock; the admin Playwright suite can remain green.
**Expected:** CI starts disposable PostgreSQL/Redis, migrates/seeds, runs HTTP contract tests for all endpoint families, and runs a smaller admin E2E suite against the real API.
**Actual:** backend and frontend are verified against separate mocks.

### BAI-06 — P2 — Development auth is permissive by default and can silently grant super-admin

**Affected:** deployment configuration; likely owner: Platform/Security.
**Evidence:** `AUTH_MODE` defaults to `development`; absent development headers default to `PLATFORM_SUPER_ADMIN` and tenant `*`. Production rejects this unless explicitly overridden, which is a good safety check, but any non-production environment exposed outside a developer machine is unauthenticated super-admin by default.

**Reproduction:** launch with `NODE_ENV=staging` (or unset), omit `AUTH_MODE`, and request a protected endpoint without credentials. Authentication constructs a super-admin identity.
**Expected:** development bypass requires an explicit opt-in and binds only to a safe local environment; staging defaults to Auth0.
**Actual:** all non-production modes accept implicit privileged development identity.
**Security:** high impact if a preview/staging deployment is reachable.

### BAI-07 — P3 — Tenant selection is hard-coded to the first authorized tenant

**Affected:** platform super-admin and multi-tenant support users; likely owner: Admin.
**Evidence:** `getAdminData` sets `selectedTenant = tenants[0]` and every downstream call uses it. No persisted/query tenant selection is passed into the loader.

**Reproduction:** authenticate with two authorized tenants and navigate the admin. Only the first tenant's records are loaded.
**Expected:** explicit tenant selector and tenant ID propagated to reads/actions.
**Actual:** ordering (`createdAt desc`) decides operational context.

### BAI-08 — P3 — Several backend capabilities have no admin integration

**Affected:** audit, app editing, policy authoring, timetable editing; likely owner: Product/Admin.
**Evidence:** no admin caller for GET audit events, PATCH app, POST arbitrary policy, PATCH timetable block, or manual command-dispatch run.

**Expected:** either expose required operational capabilities with permissions and UX, or document endpoints as device/internal-only.
**Actual:** API capability and portal capability are not traceably aligned.

## Security and data-integrity observations

- Positive: global guard checks tenant claim before permission; services commonly re-check `tenantId` on nested IDs, limiting IDOR/cross-tenant access.
- Positive: global `ValidationPipe` uses whitelist plus `forbidNonWhitelisted`/`forbidUnknownValues`; body size, CORS, Helmet, and rate limiting are configured centrally.
- Positive: production blocks development auth by default; Auth0 verifies issuer/audience and stored account suspension/forced logout.
- Positive: wipe has a dedicated `device:wipe` permission and confirmation semantics in unit tests.
- Risk: no live two-tenant fixture test proves every nested endpoint rejects foreign IDs and leaves zero side effects. This should be a mandatory generated matrix in CI.
- Risk: no demonstrated idempotency key at the HTTP boundary for admin mutations; device command result paths have service-level lifecycle protections, but network retries across other create endpoints can duplicate or conflict.
- Risk: audit logging is implemented for many state changes, but there is no systematic test asserting one audit record (actor, tenant, old/new value, outcome) for every mutation, nor a failed-attempt audit policy.
- Risk: retention application is destructive and lacks a full database integration/backup-restore test.

## Untested and external risks

1. Real PostgreSQL migrations, constraints, transactions, pagination plans, CSV export bytes, and concurrent updates.
2. Redis/BullMQ delivery, worker crash recovery, duplicate jobs, retry/dead-letter behavior, and queue observability.
3. Auth0 JWKS rotation, token expiry, invitation delivery, MFA claim synchronization, and session revocation end to end.
4. Google Android Management API credentials, quota/429 behavior, partial provider failures, policy reconciliation, and real-device command results. Stub/mapper tests do not establish provider compatibility.
5. Cross-tenant HTTP test for every nested ID and export endpoint using two seeded tenants.
6. Rate limit behavior behind the actual reverse proxy and trusted `X-Forwarded-For` chain.
7. Large roster/import payloads at the 1 MB request limit and formula-injection safety in generated CSV files.
8. Frontend behavior for 401, 403, 404/stale IDs, 409, 422/validation, 429, 500, timeout, and partial upstream availability.

## Recommended verification gate

Before a pilot, add a disposable-infrastructure CI job that migrates and seeds two tenants, derives the OpenAPI document, and executes a table-driven HTTP suite for all 68 operations. Each mutation should assert success response/schema, malformed-body rejection, missing permission, wrong tenant, missing/stale resource, duplicate/retry behavior, persistence side effect, and audit event. Then run representative Playwright flows against that same API instead of the mock. Keep real Auth0 and Android Management checks as separately credentialed staging smoke tests.
