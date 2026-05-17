# Staff User Management

Phase 1 supports tenant-scoped staff user lifecycle management. Auth0 remains the identity provider for login, MFA, password reset, and future SSO readiness; this API stores the school-facing user record, role, tenant scope, lifecycle state, and forced logout metadata.

## Staff Roles

Invitable tenant staff roles:

- `SCHOOL_ADMIN`
- `IT_ADMIN`
- `ACADEMIC_ADMIN`
- `TEACHER`
- `SUPPORT_AGENT`
- `BILLING_ADMIN`
- `AUDITOR`

`PLATFORM_SUPER_ADMIN`, `STUDENT`, and `GUARDIAN` are not tenant staff invitation roles in Phase 1.

## Endpoints

- `GET /api/v1/tenants/:tenantId/users`
  - Requires `tenant:read`.
  - Lists tenant users and staff lifecycle metadata.
- `POST /api/v1/tenants/:tenantId/users/invitations`
  - Requires `user:invite`.
  - Creates an invited staff user record.
- `PATCH /api/v1/tenants/:tenantId/users/:userId/role`
  - Requires `user:invite`.
  - Updates staff role and sets `forcedLogoutAt`.
- `POST /api/v1/tenants/:tenantId/users/:userId/suspend`
  - Requires `user:suspend`.
  - Sets status to `SUSPENDED` and sets `forcedLogoutAt`.
- `POST /api/v1/tenants/:tenantId/users/:userId/deactivate`
  - Requires `user:suspend`.
  - Sets status to `DEACTIVATED` and sets `forcedLogoutAt`.
- `POST /api/v1/tenants/:tenantId/users/:userId/reactivate`
  - Requires `user:suspend`.
  - Sets status to `ACTIVE`.
- `POST /api/v1/tenants/:tenantId/users/:userId/force-logout`
  - Requires `user:suspend`.
  - Updates `forcedLogoutAt` for future session invalidation checks.
- `PATCH /api/v1/tenants/:tenantId/users/:userId/mfa`
  - Requires `user:suspend`.
  - Updates stored MFA enrollment metadata.

## MFA Metadata

The API marks these roles as MFA-required in user summaries:

- `SCHOOL_ADMIN`
- `IT_ADMIN`
- `SUPPORT_AGENT`

Actual MFA challenge and enrollment enforcement remains an Auth0 responsibility in Phase 1.

## Audit Events

- `user.invite`
- `user.role_update`
- `user.suspend`
- `user.deactivate`
- `user.reactivate`
- `user.force_logout`
- `user.mfa_update`

Each event is tenant-scoped and includes the actor id when available.

## Regression Cases

- Duplicate email invitations are rejected per tenant.
- Invalid branch ids are rejected.
- Role updates force logout and are audited.
- Suspension and deactivation force logout and are audited.
- Reactivation clears suspension/deactivation timestamps.
- Cross-tenant user ids are not found.
- Users without `user:invite` cannot invite or change roles.
- Users without `user:suspend` cannot suspend, deactivate, reactivate, force logout, or update MFA metadata.
