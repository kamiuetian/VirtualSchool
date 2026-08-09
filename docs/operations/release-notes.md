# Release Notes

## 0.1.0

- Created Phase 1 monorepo foundation.
- Added shared policy precedence and RBAC types.
- Added NestJS API starter with health and tenant endpoints.
- Added worker starter.
- Added Next.js admin portal shell.
- Added initial Prisma schema.
- Added Docker Compose and CI foundation.

# High-risk policy approval and comparison

Tenant-configurable approval proposals now capture before/after policy state for broad unlock, web-block removal, and exam changes. Separation of duties, configurable quorum, expiry, decisions, outcomes, tenant isolation, and audit evidence are enforced by the approval API.
