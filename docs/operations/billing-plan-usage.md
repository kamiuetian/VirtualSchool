# Billing And Plan Usage

Phase 1 billing is usage-display and plan-governance only. It does not charge cards or create invoices inside the product. Payment processing can be added later without changing the tenant usage model.

## API Endpoints

- `GET /api/v1/tenants/:tenantId/billing/subscription`
  - Requires `billing:read`.
  - Returns the tenant subscription metadata, plan key, billing contact, billing period, trial date, and any explicit limit overrides.
- `GET /api/v1/tenants/:tenantId/billing/usage`
  - Requires `billing:read`.
  - Returns current usage for billable devices, active students, staff users, branches, classes, app catalog items, policies, and commands in the current billing period.
- `PATCH /api/v1/tenants/:tenantId/billing/subscription`
  - Requires `billing:manage`.
  - Updates plan/status metadata, billing email, billing period, trial date, limit overrides, and notes.
  - Mirrors `Tenant.planKey` when the subscription plan changes.
  - Writes an audit event with old and new subscription values.

## Plan Catalog

The server includes Phase 1 plan defaults:

- `pilot`: controlled rollout for up to 300 billable tablets.
- `starter`: first production school rollout.
- `growth`: larger multi-campus rollout.
- `enterprise`: custom plan with unlimited defaults unless explicit overrides are set.

Subscription overrides currently support device, student, staff, and branch limits. Other limits come from the plan catalog.

## Usage Semantics

- Billable devices exclude `RETIRED` devices.
- Active students count `ACTIVE` and `PENDING` students.
- Staff users exclude `DEACTIVATED` users.
- Commands are counted between `billingPeriodStart` and `billingPeriodEnd`; if no billing period is configured, the current UTC month is used.
- A metric is marked `overLimit` when usage is greater than the effective limit.
- A metric contributes to warning totals when it is at least 80% used and not already over limit.

## RBAC

- `SCHOOL_ADMIN`, `BILLING_ADMIN`, and `PLATFORM_SUPER_ADMIN` can read and manage billing subscription metadata.
- Other roles have no billing access unless their role permissions are changed.

## Regression Cases

- Billing read APIs are tenant-scoped by the global tenant guard.
- New tenant creation creates an initial billing subscription row.
- Usage metrics apply subscription overrides before plan defaults.
- Over-limit and 80% warning totals match the returned metrics.
- Subscription update writes an audit event and updates `Tenant.planKey`.
