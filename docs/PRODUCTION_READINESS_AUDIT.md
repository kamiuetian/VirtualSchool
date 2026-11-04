# Production Readiness Audit

Audit date: 2026-08-10
Scope: repository-wide static audit of API, admin, worker, Android applications, infrastructure, CI/CD, configuration, data, observability, tests, and documentation. Test fixtures are not themselves production defects when isolated to test execution; findings below focus on defaults, runtime reachability, deployment gaps, or tests that create false production confidence.

## Executive summary

The repository is a substantial functional prototype, but it must not be promoted with its current defaults. The two release-blocking themes are fail-open privileged development authentication and fail-open stub MDM dispatch. The current Docker Compose file is local infrastructure, not a production deployment: it publishes databases with committed credentials and no Redis authentication/TLS. The browser/launcher clients are also incomplete production clients: managed configuration is read locally, but queued browser events are never uploaded, and launcher shortcuts allow cleartext HTTP.

Production acceptance should require an explicit, validated `production` configuration profile that fails startup when identity, database, Redis, MDM, encryption, public URLs, or telemetry are absent; separate test-only wiring; real API/database browser tests; immutable images; secret-manager injection; and deployment smoke/rollback evidence.

## Findings

### PR-001 — Critical — API authentication defaults to unauthenticated platform super-admin

- Evidence: `apps/api/src/modules/auth/auth.service.ts:21-32, 51-52, 100-127`; `.env.example:16-17`.
- Current behavior: missing or unrecognized `AUTH_MODE` becomes `development`; a request without credentials receives `PLATFORM_SUPER_ADMIN`, tenant `*`, and a synthetic identity. Only the exact `NODE_ENV=production` string disables it, and `ALLOW_DEVELOPMENT_AUTH_IN_PRODUCTION=true` re-enables it.
- Production risk: a staging, preview, container, or incorrectly labelled production deployment is a fully unauthenticated tenant-wide administrative API. A typo in `AUTH_MODE` silently selects development instead of failing.
- Remediation/acceptance: remove development auth from the production module graph or require an explicit local-only test flag plus loopback binding. Parse an allowlisted mode and fail startup on missing/invalid values. Production and staging must require Auth0 settings; no override may enable header auth in production. Add startup-config tests and HTTP tests proving anonymous/dev-header requests return 401 in every deployable profile.

### PR-002 — Critical — Admin authentication bypass can be enabled in production

- Evidence: `apps/admin/lib/auth/session.ts:26-41, 54-73, 133-185`; `apps/admin/app/login/page.tsx:64-123`; `.env.example:26-30`.
- Current behavior: `ADMIN_AUTH_BYPASS=true` returns a synthetic super-admin session before the production/Auth0 checks. Development cookies are unsigned base64 JSON, and the development login exposes free-form role and `*` tenant scope. The password field is cosmetic and is not validated.
- Production risk: one environment variable bypasses all authentication and tenant controls in the production UI; a misconfigured preview/admin instance can mint arbitrary privileged sessions.
- Remediation/acceptance: compile bypass/persona login only into a test entry point, or reject it unconditionally outside an explicit local test profile. Validate production startup requires Auth0 client/secret/session secret and HTTPS base URL. Add deployment tests proving `/login` cannot render persona controls and bypass cannot start under production/staging.

### PR-003 — Critical — MDM API and worker silently succeed through stub connectors

- Evidence: `apps/api/src/modules/mdm-connectors/mdm-connector.registry.ts:15-18`; `apps/api/src/modules/mdm-connectors/stub-mdm.connector.ts:11-52`; `apps/worker/src/workers/worker-mdm.connector.ts:32-42`; `.env.example:37`; `docs/operations/worker-integration.md:25,39`; `docs/operations/remote-commands.md:43`.
- Current behavior: any value other than exact `android-management` selects a stub. The stub reports commands accepted/delivered and policies published with fabricated `stub:` identities without contacting Google.
- Production risk: destructive/security commands and policy publication can be recorded as successful while devices receive nothing. Missing configuration creates false operational assurance rather than a hard failure.
- Remediation/acceptance: move the stub to test-only dependency injection. Production/staging must fail startup unless the real connector, enterprise ID, credentials, and connectivity check pass. Persist provider operation state only from real responses; expose connector mode in readiness/metrics. End-to-end staging tests must verify a managed test device/policy and reject all `stub:` identifiers.

### PR-004 — High — Local Docker Compose publishes insecure data services

- Evidence: `docker-compose.yml:1-29`; `.env.example:14-15`.
- Current behavior: PostgreSQL uses committed `virtualschool/virtualschool`, both PostgreSQL and Redis publish on all host interfaces, Redis has no authentication, neither service configures TLS, and images use mutable tags.
- Production risk: reuse of this Compose definition exposes school data and queue/control traffic with known or absent credentials; mutable images make releases non-reproducible.
- Remediation/acceptance: label Compose explicitly local-only and create a production deployment using private subnets/security groups, secret-manager credentials, encryption in transit/at rest, Redis AUTH/ACL, backups/PITR, key rotation, pinned image digests, resource limits, and restore tests. Automated policy must reject local Compose credentials in deploy manifests.

### PR-005 — High — Runtime configuration defaults to localhost and does not fail fast

- Evidence: `apps/admin/lib/api.ts:34-36`; `apps/worker/src/workers/worker-queue.service.ts:155`; `.env.example:2-46`.
- Current behavior: admin API and worker Redis silently fall back to localhost. The example profile defaults to development/debug, local URLs, Swagger, development auth, and stub MDM; AWS values are explicitly placeholders.
- Production risk: incorrectly configured workloads start but connect to themselves, lose jobs, display generic reconnect behavior, or run unsafe modes. Copying `.env.example` is dangerous.
- Remediation/acceptance: centralize typed configuration validation for every process and require URLs/secrets in non-test environments. Supply separate `.env.local.example` and production variable contract with no credentials/default endpoints. CI must boot each artifact with production validation and assert missing/placeholder values stop startup with actionable errors.

### PR-006 — High — Admin end-to-end tests exercise a mock, not the production API contract

- Evidence: `apps/admin/playwright.config.ts:3-50`; `apps/admin/tests/mock-api.mjs:1-624`; `apps/admin/tests/e2e/admin-portal.spec.ts:22,461`; `docs/quality/backend-api-integration-audit.md:11,23,94,142-148`.
- Current behavior: Playwright starts a deterministic Node mock on port 4100 and Next dev server. Mock responses, auth headers, validation, persistence, tenant isolation, errors, and side effects can diverge from Nest/PostgreSQL while tests remain green.
- Production risk: UI/API incompatibility and authorization or persistence defects are not release-blocking.
- Remediation/acceptance: keep unit-level mock tests clearly named, but add a required integration suite using production builds, migrated ephemeral PostgreSQL/Redis, real Nest HTTP, two tenants, and production-like auth tokens. Cover representative mutations, 401/403, wrong-tenant IDs, validation, retries, persistence, audit rows, and worker effects. Contract/OpenAPI drift must fail CI.

### PR-007 — High — Browser telemetry is only queued locally and never delivered

- Evidence: `apps/android-browser/src/main/java/com/virtualschool/browser/BlockedEventReporter.kt:22-46`.
- Current behavior: blocked-navigation events are stored as plaintext JSON in SharedPreferences (maximum 500) and logged; no uploader, authentication, encryption policy, acknowledgement, backoff, or retention lifecycle exists.
- Production risk: safety/audit events silently remain on devices and are lost through overflow/uninstall; domain data is locally exposed and logs can leak browsing metadata.
- Remediation/acceptance: implement authenticated batched upload to a tenant/device-scoped API with encrypted storage, WorkManager retry/backoff, server acknowledgement before deletion, bounded retention, redaction, metrics, and consent/privacy documentation. Device-offline/overflow/reboot tests must prove eventual delivery without duplicate audit events.

### PR-008 — High — Android launcher accepts cleartext HTTP shortcuts

- Evidence: `apps/android-launcher/src/main/java/com/virtualschool/launcher/policy/LauncherPolicy.kt:26-31`; both Android manifests lack an explicit restrictive network-security configuration.
- Current behavior: managed shortcuts accept `http://` as well as HTTPS.
- Production risk: student navigation and content can be intercepted or modified, undermining the secure-browser policy.
- Remediation/acceptance: allow HTTPS only by default; if legacy HTTP is unavoidable, require a narrowly scoped, audited tenant exception and Android network security config. Add tests for scheme confusion, redirects, IDN/punycode, user-info, IP literals, and cleartext rejection.

### PR-009 — High — No production-grade Android release/signing pipeline is present

- Evidence: `apps/android-launcher/build.gradle.kts`, `apps/android-browser/build.gradle.kts`, root `build.gradle.kts`; `.github/workflows/ci.yml` contains validation/build checks but no signed artifact/provenance flow.
- Current behavior: modules define buildable applications but repository automation does not demonstrate protected signing keys, release variants, R8/resource shrinking, SBOM/provenance, malware/dependency scanning, Play/managed-Google distribution, or upgrade/rollback validation.
- Production risk: debug or unverifiable APKs can reach devices, signing continuity is unmanaged, and releases cannot be traced or safely rolled back.
- Remediation/acceptance: add hardened release variants and CI signing via protected key service, pinned toolchains, lint/unit/instrumentation tests, SBOM and signed provenance, artifact retention, managed-track publishing, and upgrade/rollback tests on supported devices. Prove debug signing/debuggable builds cannot be deployed.

### PR-010 — High — Deployment workflow does not establish a complete production release gate

- Evidence: `.github/workflows/deploy.yml`; `.github/workflows/ci.yml`; `.github/workflows/codex-feature-cycle.yml:24,55-66`; `.github/workflows/nightly.yml:4-6`.
- Current behavior: feature automation runs on a machine-specific self-hosted runner and invokes an absolute local Codex CLI path. CI credentials use local sample database credentials; mocked UI tests are the browser gate. Nightly testing is scheduled rather than a required deploy gate.
- Production risk: releases depend on mutable workstation state, cannot be reproduced on clean infrastructure, and may deploy without real-service, migration, security, or rollback verification. A compromised self-hosted runner has broad repository/environment reach.
- Remediation/acceptance: build immutable artifacts once on ephemeral least-privilege runners; pin actions by digest/SHA; use protected environments and OIDC; add SAST, dependency/container/IaC/secret scans, migration dry-run/backup gate, real integration/E2E, signed artifacts, deploy health smoke, progressive rollout, and automated rollback. Self-hosted Codex feature generation must not have production secrets or deployment authority.

### PR-011 — Medium — API proxy/rate-limit/security defaults are deployment-sensitive

- Evidence: `apps/api/src/main.ts:18-44, 78-113`; `apps/api/src/modules/security/rate-limit.middleware.ts:15`.
- Current behavior: trust proxy is on unless explicitly false; rate limits are process-local/configured by permissive defaults; health/docs paths are skipped; CSP and cross-origin embedder policy are disabled; requests without Origin are allowed.
- Production risk: incorrect proxy topology enables spoofed client addresses; horizontal replicas do not share throttling state; disabled browser-facing policies and public docs broaden attack surface.
- Remediation/acceptance: validate trusted proxy hops/CIDRs per environment, use shared Redis-backed rate limiting with tenant/user keys, separately protect expensive/health endpoints, disable docs publicly, and document/test security headers and CORS at the edge. Pen-test spoofed forwarding headers and multi-replica limits.

### PR-012 — Medium — Health/readiness does not cover Redis, MDM, identity, or migrations

- Evidence: `apps/api/src/modules/health/health.controller.ts:15-45`; worker has no equivalent externally verifiable readiness endpoint; Terraform dashboards describe infrastructure health but do not prove application dependencies.
- Current behavior: API readiness checks only a simple database query. Stub mode, missing Redis, invalid Auth0/JWKS, unapplied migrations, and unusable Google credentials can still appear operational.
- Production risk: orchestrators route traffic and operators declare a release healthy while critical control-plane functions cannot work.
- Remediation/acceptance: add shallow liveness and dependency-aware readiness for schema version, Redis/queue, configured identity metadata, and active MDM connector (without destructive calls); add worker heartbeat/queue lag. Alerts and deployment smoke tests must exercise a safe end-to-end command/policy path.

### PR-013 — Medium — Observability is incomplete and optional

- Evidence: `packages/shared/src/observability.ts:57-61`; `.env.example:46`; `infra/terraform/observability.tf`; repository contains committed `admin.stdout.log`, `api.stdout.log`, `api.stderr.log`, and `logs/` artifacts in the workspace (currently ignored status must be continuously enforced).
- Current behavior: application logging is console JSON; `SENTRY_DSN` is only an empty placeholder and no complete tracing/error-reporting integration is evident. No demonstrated PII scrubbing, correlation propagation across admin/API/worker/Android, SLOs, or tested alert delivery exists.
- Production risk: failures and cross-service command history are difficult to diagnose; logs can expose student/device data; disk logs can leak or exhaust hosts.
- Remediation/acceptance: implement centralized structured logs, metrics and traces with request/tenant/device-safe correlation IDs, redaction allowlists, retention/access controls, queue/MDM/business SLIs, actionable alerts, and synthetic checks. Add tests preventing secrets/PII in logs and verify alert delivery/runbooks in staging. CI must reject tracked runtime logs/build output.

### PR-014 — Medium — Android policy state and cached event data use unencrypted SharedPreferences

- Evidence: `apps/android-browser/src/main/java/com/virtualschool/browser/policy/ManagedBrowserPolicyStore.kt:10`; `apps/android-launcher/src/main/java/com/virtualschool/launcher/policy/ManagedPolicyStore.kt:10`; `apps/android-browser/src/main/java/com/virtualschool/browser/BlockedEventReporter.kt:23`.
- Current behavior: cached policy and browsing-event data are locally stored without application-level encryption or integrity signature. Managed configuration is trusted as the source, with local cached fallback.
- Production risk: on compromised/debuggable devices, policy/event data can be read or altered; stale cached policy may persist without expiry/revocation semantics.
- Remediation/acceptance: use Android Keystore-backed encrypted storage, signed/versioned policy envelopes, monotonic version and expiry/revocation checks, device integrity posture, and secure wipe on unenrollment. Test rollback, tamper, clock skew, reinstall, and managed-config removal.

### PR-015 — Medium — Product sample exports and example identities are runtime routes without environment labeling

- Evidence: `apps/admin/app/roster/sample.csv/route.ts`; `apps/admin/app/roster/classes-sample.csv/route.ts`; `apps/admin/app/tenants/staff-sample.csv/route.ts`; `apps/admin/app/apps/sample.csv/route.ts`; `apps/admin/app/devices/assignment-sample.csv/route.ts`; `apps/admin/app/login/page.tsx:71,93,101-115`.
- Current behavior: CSV templates contain named fictional people/example emails and are served by production routes; development identity defaults appear authentic and the UI does not display a persistent non-production/demo banner.
- Production risk: templates may be imported unchanged, polluting tenant records, while screenshots/operators can confuse sample identities for genuine records.
- Remediation/acceptance: retain templates only as clearly labelled schema examples with unmistakable `SAMPLE-*` values and import validation/warnings; remove development identity UI from production bundles. Non-production environments must display an unmissable environment/data banner, and production must reject demo seed markers.

### PR-016 — Medium — Data migration, seed, backup, and recovery controls are not production-demonstrated

- Evidence: `apps/api/prisma/migrations/**`; `docker-compose.yml:10-11`; deployment/operations documentation contains local migration guidance but no automated production backup/restore evidence.
- Current behavior: many forward migrations exist and local Docker persists a named volume, but no production seed separation, pre-deploy compatibility check, backup/PITR policy, restore drill, zero-downtime expand/contract discipline, or tenant data deletion verification is enforced in release automation.
- Production risk: schema deployment can lock/fail or make rollback impossible; loss/corruption cannot be recovered within an established RPO/RTO; demo data could enter production through ad-hoc seeding.
- Remediation/acceptance: classify migrations for backward compatibility, run them with least privilege and advisory locking, back up before risky changes, prove restore/PITR quarterly, prohibit test/demo seeds in production, and add migration tests from the oldest supported release with rollback/run-forward procedures.

### PR-017 — Medium — Billing is an internal record model, not a production billing integration

- Evidence: `apps/api/src/modules/billing/billing-plans.ts`; `apps/api/src/modules/billing/billing.service.ts`; admin billing pages and DTOs update subscription state directly; no payment provider/webhook/reconciliation connector is present.
- Current behavior: plans, usage, and subscription fields are maintained in the application database without demonstrated provider authority, signed webhooks, invoicing/tax handling, reconciliation, or immutable commercial audit trail.
- Production risk: displayed entitlement/payment status can diverge from contractual billing and be changed as ordinary application state.
- Remediation/acceptance: explicitly classify billing as manual/offline for the intended release or integrate an approved provider with idempotent signed webhooks, reconciliation, entitlement separation, finance audit controls, tax/privacy handling, and failure/dispute workflows. UI must accurately label the source of truth.

### PR-018 — Medium — User invitation/lifecycle is not integrated end-to-end with the identity provider

- Evidence: `apps/api/src/modules/users/users.service.ts`; `apps/api/src/modules/auth/auth.service.ts`; `docs/quality/backend-api-integration-audit.md:67,191`.
- Current behavior: staff lifecycle records and invitation state exist locally, but no demonstrated Auth0 Management API invitation/provisioning, claim synchronization, MFA enforcement callback, or deprovisioning reconciliation exists.
- Production risk: local status/role/MFA indicators can diverge from tokens and provider accounts, leaving access active or misleading administrators.
- Remediation/acceptance: implement provider-backed invitation, role/tenant claims, MFA and suspension/revocation with idempotent reconciliation and audit events. Staging tests must prove invite, first login, role change, forced logout, suspension, tenant removal, and provider failure recovery.

### PR-019 — Low — Android launcher contains malformed visible punctuation and minimal accessibility/localization

- Evidence: `apps/android-launcher/src/main/java/com/virtualschool/launcher/MainActivity.kt:58-74,97-114` (the mode line contains `Â·`); UI strings are hard-coded rather than Android resources.
- Current behavior: production-visible text is programmatically hard-coded and includes an encoding artifact; controls lack a demonstrated localization/accessibility QA path.
- Production risk: poor content quality and accessibility for students; changes cannot be translated or centrally audited.
- Remediation/acceptance: move strings/styles to resources, fix encoding, add content descriptions/focus/touch-target/dynamic-text support, localization readiness, and accessibility/instrumentation testing on supported form factors.

## Test-only assets that must remain isolated

The following are legitimate test mechanisms if packaging and deployment rules guarantee they cannot become runtime dependencies: `apps/admin/tests/mock-api.mjs`, unit-test mocks/fixtures, Playwright loopback ports, example-domain test values, and controller service doubles. Acceptance is a build-manifest check proving test directories and dev dependencies are absent from production artifacts, plus a distinct real-service integration gate as described in PR-006.

## Recommended remediation order

1. Block release on PR-001 through PR-005: fail-closed auth/MDM and validated production configuration/infrastructure.
2. Establish real integration/release evidence (PR-006, PR-009, PR-010, PR-012, PR-016).
3. Complete device telemetry, transport, state integrity, and identity lifecycle (PR-007, PR-008, PR-014, PR-018).
4. Close operational/content gaps (PR-011, PR-013, PR-015, PR-017, PR-019).

## Remediation progress (2026-08-10)

- PR-001 â€” **Partially remediated:** `AUTH_MODE` is now allowlisted and mandatory; development auth is rejected at startup outside `NODE_ENV=development|test`, and the former production override is removed. Focused startup/auth tests pass. Remaining: production-profile HTTP tests with real signed Auth0 fixtures proving anonymous and development headers receive 401.
- PR-002 â€” **Partially remediated:** admin bypass and persona sign-in now require both `ADMIN_LOCAL_TEST_AUTH=true` and a development/test runtime. Production login no longer renders persona controls when Auth0 is absent. Remaining: production-build deployment tests and strict validation of Auth0/session secret/HTTPS configuration at process startup.
- PR-003 â€” **Partially remediated:** API and worker connector selection now fails closed unless `MDM_CONNECTOR_MODE=android-management`; worker stub success responses were removed, and registry/worker tests pass. Remaining: startup credential/connectivity readiness and managed-device staging verification.
- PR-004 â€” **Partially remediated:** Compose is labelled local-only, database ports bind to loopback, passwords must be supplied externally, and image patch versions are pinned. Remaining: a production deployment definition and managed-service backup/TLS/ACL/restore evidence.
- PR-005 â€” **Partially remediated:** admin API and worker Redis localhost fallbacks are removed; production URLs enforce HTTPS/TLS; production and local environment contracts are separated. Remaining: centralized startup validation for every process and CI negative-profile boot tests.
- PR-008 â€” **Remediated in code:** launcher shortcuts accept parsed HTTPS URLs only, reject credentials and IP literals, and the manifest/network security configuration rejects cleartext. Unit-test coverage was expanded. Android verification is blocked locally because the repository has no Gradle wrapper and no system Gradle executable.
- PR-015 — **Partially remediated:** downloadable roster/class/staff/device templates now use unmistakable `SAMPLE-*` markers and reserved `.invalid` email domains. Environment/test-data banners were removed from the customer-facing application because deployment metadata must not alter or contaminate the product UI. Remaining: reject sample markers across every production import path and add route/build tests proving persona controls are absent.
- PR-019 â€” **Partially remediated:** launcher-visible strings moved to Android resources, the punctuation encoding is correct, and action controls enforce a 48dp minimum touch target. Remaining: instrumentation accessibility/localization QA across supported form factors.

Verification completed: full API tests (117 passing), full worker tests (7 passing), full admin unit tests (5 passing), and API/worker/admin TypeScript type checks. Android Gradle verification blocked as noted above.

AUDIT COMPLETE
