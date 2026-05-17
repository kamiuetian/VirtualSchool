# Admin Onboarding Guide

This guide will help school admins complete the first-run setup checklist:

1. Create the school tenant profile.
2. Configure branches, timezone, school hours, weekends, holidays, and academic year dates.
3. Invite staff users and assign role-scoped permissions.
4. Import students, guardians, teachers, classes, and memberships.
5. Select default policy templates.
6. Configure the approved app catalog and web allowlists.
7. Generate an Android enrollment batch.
8. Enroll and assign the first device.
9. Validate policy deployment, launcher layout, and reporting.

## Approved App Catalog

Before enrolling pilot devices, configure at least one approved app with:

- App name and Android package ID.
- Approved grades or sections.
- Install rule, such as available, force installed, or blocked.
- Approval status.

The Phase 1 API exposes this setup through:

- `GET /api/v1/tenants/{tenantId}/apps`
- `POST /api/v1/tenants/{tenantId}/apps`
- `PATCH /api/v1/tenants/{tenantId}/apps/{appId}`

Duplicate package IDs are blocked per tenant. Deprecating or blocking an app should be
done before policy assignment changes so admins have a clear audit trail.

## Starter Policies

Create the Phase 1 starter policies before pilot enrollment:

- Grade 1-3 Lockdown
- Grade 4-8 Supervised Learning
- Homework Mode
- Exam Starter Mode
- Lost Device Mode
- Maintenance Mode
- Default School Mode

Use `POST /api/v1/tenants/{tenantId}/policies/starter-templates` to create any missing
templates. Use `POST /api/v1/tenants/{tenantId}/policies/{policyId}/publish` when a
template is ready for pilot deployment. Publishing increments the policy version and
writes a version snapshot for rollback and audit review.
