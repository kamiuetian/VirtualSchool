# Virtual School Device Management Platform

This repository is the Phase 1 implementation workspace for the Android Managed Learning Device Platform.

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

## Current Development Slice

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
