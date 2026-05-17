# Phase 1 Market-Ready Implementation And Deployment Plan

## 1. Executive Summary

Phase 1 delivers the first sellable product for the Virtual School Device Management Platform: an Android-first SaaS platform for school-owned managed tablets.

The product must allow a school to onboard, create rosters, enroll Android devices, assign devices to students and classes, define allowed apps and websites, schedule learning modes, issue remote commands, review compliance, export reports, and maintain auditability without custom engineering per school.

### Product Positioning

The platform should be positioned as an education-specific managed learning device platform, not as a generic MDM tool or surveillance product.

Core promise:

> Turn school-owned Android tablets into controlled online classrooms where students can access only school-approved apps and websites during school-controlled learning modes.

### Locked Phase 1 Decisions

| Area | Decision |
| --- | --- |
| Cloud platform | AWS |
| Application stack | TypeScript full-stack |
| Admin portal | Next.js |
| Backend API | NestJS REST API |
| Data store | PostgreSQL on Amazon RDS |
| Queue/cache | Redis on ElastiCache |
| Android management | Direct Android Management API connector |
| Android apps | Kotlin with Jetpack Compose |
| Infrastructure as code | Terraform |
| CI/CD | GitHub Actions |
| Identity provider | Auth0 for Phase 1 |
| Device target | School-owned Android tablets |

### Explicit Phase 1 Exclusions

The following are out of scope for Phase 1:

- Full control of unmanaged student-owned BYOD phones or family tablets.
- Native iPadOS, ChromeOS, Windows, or Intune management.
- Deep LMS/SIS synchronization beyond CSV import/export and future-ready APIs.
- Full parent portal.
- Full teacher live operations platform.
- AI proctoring, biometric checks, hidden screenshots, webcam monitoring, microphone monitoring, keylogging, private message inspection, or any covert surveillance feature.
- Jurisdiction-specific legal automation without legal review.

## 2. Product Scope

### Phase 1 Capabilities

Phase 1 must include:

- Multi-tenant SaaS school administration.
- Tenant, branch, role, user, roster, class, and guardian management.
- Subscription plan limits and usage visibility.
- Android managed-device enrollment using enrollment tokens and QR flows.
- Device quarantine, assignment, reassignment, retirement, and inventory.
- Android policy publishing through Android Management API.
- App catalog, approved app assignment, app deployment status, and blocked app behavior.
- Web allowlists/blocklists, default-deny mode, URL testing, and secure browser behavior.
- Learning modes: Class Mode, Homework Mode, Break Mode, Maintenance Mode, Lost Device Mode, and Default School Mode.
- Timetables, recurring schedules, holidays, exceptions, and manual overrides.
- Student launcher with approved apps, web shortcuts, messages, and support contact.
- Remote lock, unlock, wipe/reset, policy refresh, check-in request, message send, and command history.
- Device diagnostics, alerts, dashboard metrics, and exportable reports.
- Immutable or tamper-resistant audit logs for privileged and sensitive actions.
- Privacy notices, consent records where guardian access is used, and configurable retention settings.
- CI/CD, production deployment, regression test suite, pilot runbook, and operating documentation.

### Market-Ready Definition

Phase 1 is market-ready only when a pilot school can:

1. Create a tenant and configure school settings.
2. Import or manually create students, guardians, teachers, classes, and class memberships.
3. Generate enrollment batches and enroll supported Android tablets.
4. Assign enrolled devices to students, classes, and policies.
5. Apply approved app and web rules.
6. Run scheduled learning modes.
7. Lock, unlock, wipe, refresh, and message devices.
8. Identify offline, non-compliant, or failed-deployment devices.
9. Export inventory and deployment reports.
10. Prove that privileged actions are authenticated, authorized, and audited.

## 3. Recommended Architecture

### Monorepo Layout

Use a single monorepo for Phase 1 to keep product, shared types, and tests aligned.

```text
apps/
  admin/
  api/
  worker/
  android-launcher/
  android-browser/
packages/
  shared/
  config/
  test-fixtures/
infra/
  terraform/
docs/
  operations/
  product/
  pilot/
.github/
  workflows/
```

### Applications

| Application | Technology | Responsibility |
| --- | --- | --- |
| `apps/admin` | Next.js, TypeScript, Tailwind, shadcn/ui | SaaS admin portal for school admins, IT admins, academic admins, support agents, billing admins, and platform admins. |
| `apps/api` | NestJS, TypeScript, Prisma, OpenAPI | Versioned REST API, authorization, business logic, policy APIs, reporting APIs, device APIs, and audit logging. |
| `apps/worker` | NestJS, BullMQ, Redis | Scheduled mode processing, command retries, Android sync, alerts, imports, exports, report generation, and cleanup jobs. |
| `apps/android-launcher` | Kotlin, Jetpack Compose | Managed student launcher exposing only active-policy approved apps, web shortcuts, messages, support contact, and current mode. |
| `apps/android-browser` | Kotlin, WebView | Secure browser enforcing policy allowlists/blocklists and reporting aggregated blocked web access events. |
| `packages/shared` | TypeScript | Shared schemas, policy types, API client types, constants, fixtures, and validation helpers. |

### Core Backend Services

| Service | Responsibility |
| --- | --- |
| Tenant service | Tenant creation, branch hierarchy, plan limits, branding, timezone, and data isolation. |
| Identity service | Auth0 integration, staff invitation, role mapping, MFA enforcement, session invalidation, and account status. |
| RBAC service | Role and permission checks across platform, tenant, branch, class, support, and billing scopes. |
| Roster service | Students, guardians, teachers, classes, grade/section, class membership, and CSV import. |
| Device service | Device inventory, assignment, health, status, compliance, reassignment, retirement, and diagnostics. |
| Policy service | Policy templates, versioning, assignments, app/web restrictions, launcher layouts, and policy publication state. |
| Policy engine | Deterministic resolution of active mode and device-ready policy. |
| Android MDM connector | Android Management API enrollment tokens, policy publishing, app management, device commands, and status sync. |
| Command service | Queueing, retrying, expiring, auditing, and reconciling remote device commands. |
| Reporting service | Dashboard metrics, inventory exports, policy deployment reports, app deployment reports, and compliance summaries. |
| Audit service | Append-only audit event creation and controlled audit search/export. |
| Notification service | Email alerts, onboarding emails, password reset handoff through Auth0, and operational notifications. |

### Public Interfaces

| Interface | Requirement |
| --- | --- |
| REST API | Versioned under `/api/v1`. |
| OpenAPI | Generated from NestJS and published as a CI artifact for every release. |
| Admin portal | Uses the public API and never bypasses backend authorization. |
| Android device API | Dedicated device endpoints for launcher check-in, launcher layout fetch, message sync, diagnostics upload, browser policy fetch, and blocked web event upload. |
| MDM connector interface | Internal abstraction so Android Management API can be replaced or expanded by future OS/MDM adapters. |
| CSV import/export | Phase 1 integration mechanism for roster and reporting workflows. |

### Tenant Isolation Standard

Every query, export, dashboard metric, report, device command, audit search, support view, and background job must include tenant scoping.

Platform support users may access tenant data only through explicitly assigned scoped support permissions, and that access must be audited.

## 4. Data Model

The Phase 1 schema should include these business objects.

| Entity | Purpose | Key fields |
| --- | --- | --- |
| Tenant | Customer school or school group | name, domain, timezone, country, data region, plan, branding, contacts, status |
| Branch | Campus or sub-organization | tenant, name, location, timezone override, status |
| SubscriptionPlan | Plan and usage limits | max devices, max students, enabled modules, support tier, renewal date |
| User | Staff, platform user, teacher, support, billing | tenant, branch, role, email, status, MFA state, Auth0 subject |
| Role | Predefined role boundary | role key, permission set, scope rules |
| PermissionOverride | Allowed custom permission within role boundaries | user, permission, scope, expiry |
| Student | Learner profile | student ID, name, grade, section, branch, status |
| Guardian | Parent/guardian record | name, contact, relationship, linked students, consent state |
| ClassSection | Academic class/section | grade, subject, branch, teachers, students, timetable |
| AcademicCalendar | School calendar | school hours, weekends, holidays, academic year dates |
| Device | Managed Android tablet | serial, model, manufacturer, Android version, enrollment state, status, health, assigned student/class, policy version |
| DeviceGroup | Targeting group | tenant, branch, class, grade, tags, model, ownership type |
| EnrollmentBatch | Bulk enrollment flow | token, QR metadata, created by, expiry, enrolled count |
| Policy | Versioned device policy | name, status, version, rules, mode mapping, assignments |
| PolicyVersion | Historical policy state | policy snapshot, actor, summary, timestamp |
| LearningMode | Contextual access state | mode type, priority, schedule, apps, websites, settings, launcher layout |
| AppCatalogItem | Approved app record | package ID, name, category, icon, approved grades, install rules |
| WebRule | URL/domain rule | URL/domain/pattern, action, scope, priority, expiry |
| RemoteCommand | Device command | type, target, status, retries, submitted by, timestamps, result |
| DeviceEvent | Device or policy event | type, device, metadata, severity, timestamp |
| WebAccessEvent | Aggregated browser block/allow event | domain, policy, device, class, count, timestamp bucket |
| SupportNote | Basic support case note | device/student, status, priority, notes, actor |
| NotificationPreference | Alert settings | recipients, thresholds, channels |
| ConsentRecord | Privacy notice acceptance | subject, actor, document version, accepted at, method |
| AuditEvent | Sensitive action record | actor, action, object, old/new values, IP/device metadata, reason, outcome |

## 5. Implementation Workstreams

### 5.1 Product Foundation

Implement first:

- Monorepo scaffolding.
- Local Docker Compose with PostgreSQL, Redis, API, worker, and admin.
- Shared ESLint, Prettier, TypeScript, test, and build configuration.
- Environment templates for local, dev, staging, and production.
- API health checks and readiness checks.
- Structured JSON logging with request IDs, tenant IDs, actor IDs, and correlation IDs.
- NestJS API versioning under `/api/v1`.
- Prisma schema, migrations, seeds, and migration validation.
- Global exception handling and consistent API error shape.
- Audit event helper used by all sensitive workflows.

Acceptance criteria:

- A developer can start the local stack from documented commands.
- API, worker, and admin have health checks.
- CI can lint, typecheck, test, build, and validate migrations.
- Tenant ID is part of all tenant-owned records and all tenant-scoped API paths.

### 5.2 Identity, RBAC, And School Setup

Implement:

- Auth0 tenant/application configuration for admin/staff authentication.
- Platform super admin tenant creation.
- Tenant profile: school name, country, timezone, language, logo, domain, plan, primary contact.
- Branch/campus management.
- Subscription plan limits for max devices, max students, enabled modules, and support tier.
- First-run checklist:
  - school profile complete
  - roster imported or first student created
  - policy template selected
  - app catalog configured
  - enrollment batch generated
  - first device enrolled
- Staff invitation, activation, suspension, and deactivation.
- MFA enforcement for platform admins and school admins.
- Password reset through Auth0.
- Session timeout and forced logout after suspension or password reset.
- RBAC for platform super admin, school admin, IT admin, academic admin, teacher, support agent, billing admin, student, guardian, and auditor/privacy officer.
- Custom permission assignment only inside predefined role boundaries.

Acceptance criteria:

- A platform super admin can create an isolated tenant.
- A school admin cannot grant platform-level privileges.
- Teachers see only assigned classes.
- Billing admins see plan and usage but not student learning records.
- Authentication events and privileged actions are audited.

### 5.3 Roster And Academic Structure

Implement:

- Student profiles with student ID, name, grade, section, branch, status, and guardians.
- Guardian records linked to one or more students.
- Teacher profiles and class assignment.
- Classes, sections, grades, subjects, academic years, and class memberships.
- Student statuses: active, pending, suspended, graduated, withdrawn.
- Blocking of new device assignment for inactive or withdrawn students.
- CSV import for students, guardians, teachers, classes, and memberships.
- Import validation preview before commit.
- Downloadable import error reports.
- Audit logging for imports and bulk changes.
- Academic-year rollover preparation as a strongly recommended Phase 1 enhancement.

Acceptance criteria:

- Admins can create and search students manually.
- Admins can import valid CSV files and receive actionable error reports for invalid rows.
- Guardian sibling links are supported.
- Historical data remains after deactivation or withdrawal.

### 5.4 Android Enrollment And MDM Connector

Implement:

- Android Management API connector with a provider-agnostic internal interface.
- Enrollment token creation.
- QR-code based enrollment flow.
- Enrollment batch creation, export, print view, expiration, and enrolled count tracking.
- Quarantined state for enrolled but unassigned devices.
- Tenant assignment before any policy is applied.
- Device assignment to student, class, branch, group, and policy.
- Duplicate serial number and duplicate enrollment detection.
- Device reassignment with old student, new student, actor, timestamp, and reason.
- Device retirement and unenrollment workflows.
- Device inventory profile with:
  - serial number
  - device ID
  - model
  - manufacturer
  - Android version
  - enrollment date
  - ownership type
  - assigned student
  - assigned class
  - branch
  - tags
  - active policy version
  - last check-in
  - compliance state
  - status
- Device health indicators:
  - battery
  - storage
  - OS version
  - last sync
  - app install status
  - policy compliance
  - network status where available
- Approved-device compatibility matrix before pilot sale.

Acceptance criteria:

- An IT admin can generate a QR enrollment token and enroll a supported Android tablet.
- Enrolled devices appear in inventory as online, pending, or enrollment failed.
- Unassigned devices cannot access student learning modes.
- A device profile shows metadata, health, assigned student/class, policy, and diagnostics.

### 5.5 Policy Engine And Learning Modes

Implement policies as structured, versioned configuration.

Required templates:

- Grade 1-3 Lockdown.
- Grade 4-8 Supervised Learning.
- Homework Mode.
- Exam Starter Mode.
- Lost Device Mode.
- Maintenance Mode.
- Default School Mode.

Required modes:

- Class Mode.
- Homework Mode.
- Break Mode.
- Maintenance Mode.
- Lost Device Mode.
- Default School Mode.

Policy precedence:

1. Lost Device Mode.
2. Exam Mode.
3. Emergency or Support Override.
4. Timetable Class Mode.
5. Homework or After-school Mode.
6. Device Baseline Policy.
7. Default School Mode.

Implement:

- Policy creation, editing, publishing, assignment, and rollback.
- Policy version history with change summary, actor, timestamp, and previous/new values.
- Assignment by tenant, branch, grade, class, device group, tag, or individual device.
- Active policy explanation on each device profile:
  - active mode
  - policy version
  - source
  - winning precedence rule
  - losing candidate rules when relevant
- Timetable schedules by class, grade, or student group.
- Weekly recurring schedules.
- Holidays, special events, exams, emergency closures, and manual exceptions.
- Manual mode override with required reason, actor, expiry, and audit event.
- Support unlock workflow with reason capture and expiry.

Acceptance criteria:

- Multiple applicable policies always resolve deterministically.
- Admins can understand why a device is in its current mode.
- Rollback restores a previous policy version and creates an audit event.
- Manual overrides expire automatically.

### 5.6 App, Web, Launcher, And Browser Controls

Implement app management:

- Tenant app catalog.
- App metadata: name, package ID, category, icon, description, approved grades, installation rules, approval status.
- App assignment to policies, classes, grades, device groups, and devices.
- Install, update, and remove commands where supported by Android Management API.
- App deployment status: installed, pending, failed, outdated, blocked.
- Blocking or hiding non-approved apps from the learning environment.

Implement web access:

- Manual website allowlists and blocklists.
- Tenant, class, policy, and mode-level rules.
- Default-deny web model for younger grades.
- URL tester showing Allowed, Blocked, or Unmatched with the matching rule.
- Aggregated blocked web event logging by policy, device, domain, and class.
- Privacy controls so detailed browsing data is not broadly exposed.

Implement launcher:

- Kotlin Jetpack Compose student launcher.
- Active-mode header.
- Approved apps only.
- Approved web shortcuts only.
- School messages.
- Support contact.
- Lost-device recovery message.
- Maintenance/support unlock handling.
- Cached last-known policy for offline enforcement.
- Hard-to-exit behavior under managed/kiosk mode where Android capabilities allow.

Implement secure browser:

- Kotlin WebView app.
- Policy fetch and local cache.
- Allow/block/default-deny enforcement.
- Blocked page with school-safe message.
- Aggregated event upload with retry.
- No private message inspection, keylogging, hidden screenshot, hidden camera, or hidden microphone functionality.

Acceptance criteria:

- Students see only active-policy approved apps and web shortcuts.
- Non-approved apps cannot be launched during managed learning modes where platform controls allow.
- Approved websites open; blocked websites do not.
- URL tester explains web rule decisions before publication.

### 5.7 Remote Operations, Reporting, And Supportability

Implement remote commands:

- Lock.
- Unlock or release from lost/support state.
- Wipe/reset for lost or retired school-owned devices.
- Request check-in.
- Policy refresh.
- Send message to one device, class, or device group.
- App install/update/remove.
- Retire/unenroll.

Command requirements:

- Queue commands for offline devices.
- Retry transient failures.
- Expire stale commands.
- Store statuses: submitted, queued, delivered, executed, failed, expired.
- Require confirmation and privileged permissions for wipe/reset.
- Require reason capture for destructive and support-unlock actions.
- Audit every remote command.

Implement support:

- Device diagnostics on the device detail page.
- Support notes attached to device or student.
- Scoped support-agent access.
- Alerts for:
  - offline devices
  - failed policy application
  - failed app installation
  - lost device status
  - repeated enrollment failures
- Tenant notification preferences for recipients and thresholds.

Implement reporting:

- Admin dashboard with devices, students, policies, app compliance, offline devices, open alerts, failed deployments, and plan usage.
- Device inventory CSV export.
- Policy deployment report.
- App deployment report.
- Dashboard filter by branch, grade, class, and device group.
- Report counts must match detail pages.

Acceptance criteria:

- Remote commands have accurate status transitions.
- Offline commands run on next check-in where supported.
- Support users can diagnose common device issues without seeing unrelated student data.
- Exports are tenant-scoped and permission-controlled.

### 5.8 Privacy, Security, And Compliance Baseline

Implement:

- Role-based access with least privilege.
- Tenant isolation in API, database, reports, support tools, exports, and background jobs.
- TLS for all public traffic.
- Encryption at rest for databases, backups, S3, and secrets.
- Audit logs for policy changes, remote commands, admin logins, exports, failed access attempts, device reassignment, wipe actions, and support unlocks.
- Privacy notices and acceptance records.
- Data retention settings for audit logs, device events, support notes, and inactive users.
- Prohibition checks to ensure no Phase 1 UI, API, backend job, Android app, or workflow enables:
  - covert webcam monitoring
  - covert microphone access
  - keylogging
  - secret screenshots
  - private message inspection
  - always-on home surveillance

Acceptance criteria:

- Destructive actions require privilege, confirmation, reason, and audit event.
- Audit events contain actor, timestamp, target object, old/new values where applicable, IP/device metadata, reason, and outcome.
- Privacy-restricted features are absent from code, API contracts, and UI.

## 6. Deployment Architecture

### AWS Environments

Create separate Terraform-managed environments:

- `dev`
- `staging`
- `prod`

Each environment should have separate secrets, databases, Redis instances, S3 prefixes or buckets, service URLs, Auth0 applications, and Android Management API configuration.

### AWS Infrastructure

| Component | Requirement |
| --- | --- |
| VPC | Public and private subnets across at least two availability zones. |
| ALB | Public HTTPS entry point with ACM certificates. |
| ECS Fargate | Services for admin web, API, worker, and one-off jobs. |
| RDS PostgreSQL | Encrypted storage, automated backups, PITR, private subnet access only. |
| ElastiCache Redis | Private subnet access only for queues and cache. |
| S3 | Encrypted buckets for imports, error reports, exports, audit/report artifacts, and build artifacts where needed. |
| Secrets Manager | Application secrets, Auth0 credentials, Google service account references, API keys. |
| KMS | Encryption keys for RDS, S3, logs, and secrets. |
| SES | Email invitations, alerts, onboarding, and support notices. |
| WAF | Basic managed rules, rate limits, and admin protection. |
| CloudWatch | Logs, metrics, alarms, dashboards, and retention. |
| Route 53 | DNS for admin/API environments. |
| Sentry | Application error monitoring and release tracking. |

### Deployment Safety

Requirements:

- GitHub Actions must authenticate to AWS using OIDC, not static AWS access keys.
- Database migrations run as controlled one-off ECS tasks before application rollout.
- Normal releases must use backward-compatible migrations.
- Production deployment requires staging success and GitHub Environment manual approval.
- Each production release must include rollback notes.
- Rollback uses the previous ECS task definition and image tag.
- Database rollback is allowed only when the migration is explicitly reversible.
- Production backups must be verified through scheduled restore tests.

## 7. CI/CD Plan

### Pull Request Workflow

Trigger:

- Every pull request to `main`.

Steps:

1. Checkout.
2. Install Node dependencies.
3. Install Android/Gradle dependencies.
4. Lint TypeScript.
5. Typecheck TypeScript.
6. Run unit tests.
7. Run API contract tests.
8. Run Prisma schema validation.
9. Run migration drift/check validation.
10. Run Android lint and unit tests.
11. Run Terraform fmt and validate.
12. Run CodeQL.
13. Run dependency audit.
14. Run Trivy filesystem/container scan.
15. Build admin, API, worker, and Android debug artifacts.

Required status checks:

- lint
- typecheck
- unit tests
- API contract tests
- migration validation
- Android tests
- Terraform validation
- security scan

### Main Branch Workflow

Trigger:

- Push to `main`.

Steps:

1. Repeat pull request checks.
2. Build Docker images for admin, API, and worker.
3. Generate SBOM.
4. Push images to Amazon ECR with commit SHA tags.
5. Deploy to `staging`.
6. Run staging migrations.
7. Run smoke tests.
8. Run Playwright regression suite.
9. Publish OpenAPI artifact.
10. Publish test reports and deployment summary.

### Production Release Workflow

Trigger:

- `release/*` branch or version tag.

Steps:

1. Verify staging deployment for the same commit.
2. Require GitHub Environment approval.
3. Snapshot production database.
4. Run production migration task.
5. Deploy ECS task definitions.
6. Run post-deploy smoke tests.
7. Publish release notes.
8. Notify release channel.

### Android Release Workflow

Trigger:

- Manual dispatch or version tag.

Steps:

1. Build signed APK/AAB for launcher.
2. Build signed APK/AAB for secure browser.
3. Run Android unit tests.
4. Run emulator smoke tests.
5. Upload internal testing artifacts.
6. Store signed artifacts with provenance.
7. Publish version metadata for device policy assignment.

### Nightly Workflow

Trigger:

- Scheduled nightly run.

Steps:

1. Full regression suite.
2. Dependency and vulnerability scan.
3. Android emulator tests.
4. API security tests.
5. Staging backup restore test.
6. Report failures to engineering/support channel.

## 8. Regression Test Plan

### Automated Regression Cases

#### Tenant Isolation

- A school admin from Tenant A cannot view Tenant B users.
- A school admin from Tenant A cannot search Tenant B devices.
- Tenant A exports do not include Tenant B rows.
- Tenant A dashboards do not count Tenant B devices.
- Background jobs process only the intended tenant scope.
- Platform support access requires explicit tenant support scope and creates audit events.

#### RBAC

- Platform super admin can create tenants.
- School admin can manage tenant settings but not platform settings.
- IT admin can manage devices and policies but not billing-only settings unless granted.
- Academic admin can manage rosters and schedules but cannot wipe devices.
- Teacher can view only assigned classes.
- Support agent can view scoped diagnostics and support notes only.
- Billing admin can view plan and usage but not student learning records.
- Suspended users cannot authenticate or keep active sessions.

#### Authentication

- Password reset works through verified email.
- Lockout occurs after repeated failed attempts.
- MFA is required for platform admin and school admin roles.
- Session timeout signs out inactive users.
- Password reset invalidates existing sessions.
- Account suspension invalidates existing sessions.
- Authentication events are audited.

#### Roster

- Valid student CSV import previews and commits successfully.
- Invalid CSV import shows row-level errors before commit.
- Error report downloads successfully.
- Guardian can link to multiple siblings.
- Class membership import creates correct teacher/student links.
- Inactive, withdrawn, or graduated students cannot receive new device assignments.
- Teachers cannot see unrelated classes.

#### Enrollment

- Enrollment batch creation generates QR metadata.
- Enrollment batch tracks enrolled count.
- Supported Android device appears in inventory after enrollment.
- Unassigned enrolled device remains quarantined.
- Quarantined device receives no student learning mode.
- Duplicate serial number triggers warning.
- Duplicate enrollment attempt is detected.
- Failed enrollment status appears in inventory and dashboard.

#### Policy Engine

- Lost Device Mode wins over every other mode.
- Exam Mode wins over timetable, homework, baseline, and default modes.
- Emergency/support override wins over timetable but expires.
- Timetable Class Mode applies during scheduled class period.
- Homework Mode applies outside school hours where configured.
- Device Baseline applies when no higher mode applies.
- Default School Mode applies as fallback.
- Device detail page explains active mode, policy version, source, and precedence.
- Policy rollback restores previous rules and creates audit event.
- Schedule exception overrides recurring timetable.
- Manual override requires reason and expiry.

#### App Controls

- Approved app appears in launcher when assigned.
- Unassigned app does not appear in launcher.
- Non-approved app is blocked or hidden during managed mode where Android allows.
- App install command status moves through queued, delivered, executed, or failed.
- Failed app deployment appears in app deployment report.
- Outdated app version appears in compliance status.
- Deprecated app removal is tracked.

#### Web Controls

- Allowed URL opens in secure browser.
- Blocked URL shows blocked page.
- Default-deny blocks unmatched URL.
- URL tester returns Allowed, Blocked, or Unmatched.
- URL tester shows matching rule and source.
- Blocked web event is aggregated by domain, policy, device, and class.
- Detailed browsing data is protected by privacy permissions.

#### Launcher

- Launcher shows only active-policy approved apps.
- Launcher shows only active-policy web shortcuts.
- Launcher changes layout when mode changes.
- Launcher displays school messages.
- Launcher displays support contact.
- Lost Device Mode shows recovery message.
- Launcher uses cached last-known policy while offline.
- Launcher syncs updated policy after reconnect.
- Student cannot exit kiosk/launcher where managed Android capabilities allow.

#### Secure Browser

- Browser fetches policy on launch.
- Browser uses cached policy offline.
- Browser blocks unmatched URL under default-deny.
- Browser uploads blocked event after reconnect.
- Browser does not expose hidden camera, microphone, keylogging, private message inspection, or secret screenshot behavior.

#### Remote Commands

- Lock command is delivered to online device.
- Lock command queues for offline device.
- Queued command executes after check-in where supported.
- Unlock requires permission and creates audit event.
- Wipe/reset requires confirmation, reason, privileged role, and audit event.
- Policy refresh updates device status.
- Message send appears in launcher or managed notification depending on active policy.
- Expired command no longer executes.
- Failed command records error reason.

#### Reporting

- Device inventory export includes only authorized tenant data.
- Policy deployment report shows device, version, outcome, and error reason.
- App deployment report shows installed, pending, failed, outdated, and blocked states.
- Dashboard counts match detail-page counts.
- Reports filter by branch, grade, class, and device group.

#### Audit

- Policy create/edit/publish/rollback is audited.
- Remote lock/unlock/wipe is audited.
- Staff invite/suspend/deactivate is audited.
- Export generation is audited.
- Device reassignment is audited.
- Support unlock is audited with reason and expiry.
- Audit events include actor, timestamp, action, object, old/new values where applicable, IP/device metadata, reason, and outcome.

#### Privacy Restrictions

- No API route exposes covert webcam control.
- No API route exposes covert microphone control.
- No API route exposes keylogging.
- No API route exposes secret screenshots.
- No UI exposes private message inspection.
- Android apps request only permissions required for launcher/browser operation.
- Browser event logs are aggregated and privacy-limited.

#### Reliability

- Last-known policy remains enforced during short connectivity loss.
- Device sync reconciles status after reconnect.
- Command queue retries transient failures.
- Stale commands expire.
- Worker jobs are idempotent.
- Policy publishing is idempotent.

#### CI/CD

- Pull request checks block merge on lint, type, test, migration, Android, Terraform, or security failure.
- Main deploys to staging only after checks pass.
- Staging smoke tests run after deployment.
- Production requires manual approval.
- Production release runs database backup before migration.
- Rollback dry run is documented and tested.
- Backup restore test runs on schedule.

### Manual And Pilot Regression Cases

Run these before and during pilot:

- Enroll 10 representative approved tablet models before pilot sale.
- Run full class-day schedule with Class, Break, Homework, Maintenance, Lost Device, and Default School modes.
- Attempt app store install during Class Mode.
- Attempt alternative browser launch during Class Mode.
- Attempt VPN app install or launch.
- Attempt access to blocked settings.
- Attempt factory reset path where Android capability allows restriction.
- Attempt safe mode behavior on each approved tablet model.
- Run lost-device drill: mark lost, lock, show recovery message, release or wipe, verify audit trail.
- Run app rollout drill: assign app to pilot class, verify install, verify status report, remove/deprecate app.
- Run offline drill: disconnect before mode change, verify last-known state, reconnect, verify sync.
- Run support drill: support agent diagnoses device without unrelated student data.
- Run parent/school transparency review using privacy notices and acceptable-use material.

## 9. Documentation Deliverables

Create these documents before pilot:

| Document | Location | Purpose |
| --- | --- | --- |
| Admin onboarding guide | `docs/operations/admin-onboarding.md` | Help school admins configure first tenant. |
| Device enrollment guide | `docs/operations/android-enrollment.md` | Explain QR enrollment, batches, quarantine, assignment, and troubleshooting. |
| Compatibility matrix | `docs/operations/android-device-compatibility.md` | Track approved models, Android versions, tested restrictions, and limitations. |
| Pilot runbook | `docs/pilot/phase-1-pilot-runbook.md` | Define pilot setup, weekly cadence, scenarios, acceptance criteria, and issue handling. |
| Support escalation guide | `docs/operations/support-escalation.md` | Define support roles, diagnostics, severity, and escalation path. |
| Privacy notice template | `docs/product/privacy-notice-template.md` | Explain what is controlled, what is logged, and what is not monitored. |
| Acceptable-use template | `docs/product/acceptable-use-template.md` | School-facing student/guardian device program rules. |
| Release notes | `docs/operations/release-notes.md` | Track market-facing changes and operational release notes. |

## 10. Pilot Plan

### Pilot Size

Use 50-300 school-owned Android tablets across 2-5 classes or one virtual-school program.

### Pilot Duration

Run for 4-8 weeks after device enrollment and staff training.

### Participants

- School admin.
- IT/admin staff.
- Academic admin.
- Teachers.
- Students.
- Parents/guardians for transparency and support acknowledgement.
- Platform support team.
- Product and engineering team.

### Pilot Scenarios

- Daily Class Mode.
- Homework Mode.
- Break Mode.
- App/web allowlist.
- Secure browser default-deny.
- Remote lock.
- Lost-device drill.
- App install/update/remove.
- Offline device behavior.
- Policy rollback.
- Report export.

### Pilot Acceptance Criteria

| Category | Acceptance criteria |
| --- | --- |
| Enrollment | Devices can be enrolled reliably and assigned without custom engineering per policy. |
| Lockdown | Students can access only approved apps and websites during managed learning modes. |
| Mode switching | Device access changes correctly based on timetable, exception, and override rules. |
| Reporting | Admins can identify offline, non-compliant, and failed-deployment devices. |
| Security | Admin actions are authenticated, authorized, and audited. |
| Reliability | Device policy remains enforced during reasonable connectivity interruptions. |
| Supportability | Support team can diagnose common issues and escalate unresolved issues. |
| Privacy | Pilot participants understand what is controlled, what is logged, and what is not monitored. |

## 11. Delivery Milestones

### Milestone 0: Discovery And Technical Validation

Duration: 2-3 weeks.

Deliverables:

- Final Phase 1 scope.
- Android Management API access path validated.
- Approved-device shortlist.
- Architecture decision record.
- Pilot success criteria.
- Initial backlog and release plan.

### Milestone 1: Foundation And Tenant Admin

Duration: 3-4 weeks.

Deliverables:

- Monorepo and CI foundation.
- Local environment.
- Tenant, branch, Auth0, RBAC, audit, and school setup.
- Basic admin portal shell.

### Milestone 2: Roster, Device Enrollment, And Inventory

Duration: 3-4 weeks.

Deliverables:

- Roster and CSV import.
- Enrollment batches and QR flow.
- Android Management API connector first pass.
- Device inventory, quarantine, assignment, health, and duplicate detection.

### Milestone 3: Policies, Modes, Apps, Web, Launcher

Duration: 4-6 weeks.

Deliverables:

- Policy engine.
- Learning modes and schedules.
- App catalog and deployment status.
- Secure browser rules.
- Student launcher first production candidate.
- Active-policy explanation.

### Milestone 4: Remote Operations, Reports, Security Hardening

Duration: 3-4 weeks.

Deliverables:

- Remote commands.
- Command queue and retries.
- Dashboards and exports.
- Alerts and support notes.
- Privacy/security checks.
- Regression suite.

### Milestone 5: Staging, Pilot Readiness, And Launch Candidate

Duration: 2-3 weeks.

Deliverables:

- Terraform AWS staging/prod environments.
- GitHub Actions deployment workflows.
- Pilot documentation.
- Approved-device compatibility matrix.
- Production release checklist.
- Pilot launch candidate.

Expected build timeline: 15-20 weeks before controlled pilot, depending on Android Management API access, device testing, and team size.

## 12. Team And Ownership

Recommended Phase 1 team:

| Role | Responsibility |
| --- | --- |
| Product owner | Scope, buyer fit, acceptance criteria, pilot feedback. |
| Technical lead | Architecture, code quality, API boundaries, deployment safety. |
| Backend engineer | API, policy engine, Android connector, command queue, reports. |
| Frontend engineer | Admin portal, onboarding, dashboards, reports, workflows. |
| Android engineer | Launcher, secure browser, device API integration, offline behavior. |
| DevOps engineer | AWS, Terraform, GitHub Actions, monitoring, release process. |
| QA engineer | Regression suite, manual device testing, pilot test cycles. |
| Security/privacy reviewer | Access controls, auditability, privacy posture, compliance evidence. |

## 13. Operational Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Android Management API access delay | Blocks direct MDM launch path | Start access/compliance process in Milestone 0; maintain architecture-level connector abstraction. |
| Device compatibility variation | Some tablets may not enforce expected controls | Define approved-device list; test representative models; publish compatibility matrix. |
| Unsupported Android policy behavior | Overpromising creates customer trust issues | UI must show supported, partial, and unsupported capabilities per device/enrollment type. |
| Student bypass attempts | Lockdown may be weakened | Restrict app install/settings, test bypass routes, monitor compliance, keep device models approved. |
| Poor connectivity | Mode changes and commands may be delayed | Cache last-known policy, queue commands, show last check-in, retry idempotently. |
| Tenant isolation bug | Severe data exposure risk | Tenant isolation tests, code review checklist, query helpers, integration tests. |
| Teacher/admin complexity | Adoption risk | Guided setup, templates, first-run checklist, simple dashboards. |
| Privacy concerns | Sales and legal blocker | Privacy-by-design, transparent notices, no invasive monitoring, audit logs, retention controls. |
| Scope creep | Delays market launch | Keep Phase 1 Android-owned-device only; move parent/teacher deep operations and integrations to Phase 2. |

## 14. Assumptions

- The implementation team can obtain Android Management API access and comply with Google Android Enterprise permissible usage requirements before production launch.
- The product will not promise controls unsupported by Android version, device model, enrollment type, or Android Management API policy capabilities.
- AWS is acceptable for the initial commercial market.
- Regional data residency can be added later as an enterprise/private deployment option.
- Auth0 is acceptable for Phase 1 identity, MFA, password reset, and session security.
- The first release targets school-owned or institution-leased Android tablets only.
- Legal counsel will review privacy notices, data processing agreements, consent flows, and jurisdiction-specific compliance obligations before commercial launch.

## 15. References

- Android Management API dedicated device policies: https://developers.google.com/android/management/policies/dedicated-devices
- Android Management API provisioning: https://developers.google.com/android/management/provision-device
- Android Management API device resource and commands: https://developers.google.com/android/management/reference/rest/v1/enterprises.devices
- Android Management API permissible usage: https://developers.google.com/android/management/permissible-usage
- GitHub Actions deployment to Amazon ECS: https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/amazon-elastic-container-service
