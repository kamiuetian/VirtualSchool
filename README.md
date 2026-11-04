# Virtual School Device Management Platform

This repository is the Phase 1 implementation workspace for the Android Managed Learning Device Platform.

## Mission

Virtual School is an open platform initiative created to promote access to quality education in developing and lower-resource communities, including countries often described as Third World countries. The project aims to help schools manage affordable learning devices, educational access, student safety, and classroom operations with technology that can be adapted to local infrastructure and needs.

Phase 1 targets school-owned Android tablets and includes the SaaS admin portal, backend API, worker service, shared policy/domain types, Android launcher, secure browser, local development environment, and CI/CD foundations.

## Workspace

```text
apps/admin              Next.js admin portal
apps/api                NestJS API
apps/worker             NestJS worker service
apps/android-launcher   Kotlin Android launcher skeleton
apps/android-browser    Kotlin secure browser skeleton
packages/shared         Shared TypeScript types and policy helpers
infra/terraform         Terraform environment skeleton
docs/                   Product, pilot, and operations docs
```

## Local Setup

1. Install Node.js, pnpm, Docker, and Java.
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Install dependencies:

```bash
pnpm install
```

4. Start local infrastructure:

```bash
docker compose up -d postgres redis
```

5. Run checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

6. Start services:

```bash
pnpm dev
```

The API listens on `http://localhost:4000/api/v1`.
The admin portal listens on `http://localhost:3000`.

## Offline lesson packs

Policy managers can mark HTTPS PDF, worksheet, and video content as offline-capable in the Apps and Web Catalog. Each offline resource requires a positive content version, exact byte size, SHA-256 digest, and at least one published policy. The device policy endpoint filters the authoritative manifest by tenant, active policy, grade, subject, and class.

Managed launchers download only HTTPS resources, activate a file only after its size and digest match, and expose verified files under the explicit **Offline Mode** heading. A newer version is downloaded to a temporary file before replacement. Archived, expired, out-of-scope, or policy-revoked resources are omitted from the next manifest and removed locally during reconciliation. After changing an offline resource, republish affected Android Management policies so their managed configuration is refreshed.

## Current Development Slice

### Education resource integrations

Tenant administrators configure Microsoft 365, Zoom, and Google Meet from the Integrations page using a secret reference (`arn:`, `vault://`, or `secret://`), never a credential value. Resources are approved per class. Launch URLs must use HTTPS and the provider's canonical host; Microsoft 365 authorization can map Microsoft 365 and Teams resources. Teachers can push an enabled mapped resource only during their own active session for that class, and every configuration, mapping, and push is audited.

The current codebase implements Milestone 1 foundations:

- pnpm monorepo structure.
- NestJS API and worker starter apps.
- Next.js admin portal shell.
- Shared Phase 1 policy, RBAC, tenant, and device types.
- Initial Prisma schema for Phase 1 entities.
- Docker Compose for PostgreSQL and Redis.
- GitHub Actions pull request checks.
- Terraform and Android project skeletons.

See `PHASE_1_IMPLEMENTATION_AND_DEPLOYMENT_PLAN.md` for the full product plan.
