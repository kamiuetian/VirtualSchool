# Phase 1 feature backlog

This is the ordered queue used by the Codex app feature cycle. Only one item may be `in-progress` at a time.

| Order | Status   | Feature                                                                                                          | Completion evidence                                                                                                          |
| ----: | -------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
|     1 | complete | Replace the worker's stub-only Android Management command dispatch with the configured production connector path | Worker tests cover production dispatch, retries, and safe stub fallback; worker integration documentation is updated         |
|     2 | ready    | Implement Terraform foundations for the AWS staging environment                                                  | Terraform validates and defines network, database, Redis, storage, secrets, and ECS foundations without embedded credentials |
|     3 | ready    | Harden Android launcher into a managed-device pilot candidate                                                    | Launcher policy behavior, offline handling, managed configuration, lint, unit tests, and debug build pass                    |
|     4 | ready    | Harden the secure browser into a managed-device pilot candidate                                                  | Allow/block rules, blocked-event reporting, offline policy behavior, lint, unit tests, and debug build pass                  |
|     5 | ready    | Expand end-to-end regression coverage for the complete admin critical path                                       | Playwright covers tenant setup, roster, enrollment, policy, device command, reporting, and role restrictions                 |
|     6 | ready    | Add staging observability and operational readiness checks                                                       | Health signals, structured logs, alerts, dashboards/runbooks, backup and recovery checks are documented and verified         |

## Status values

- `ready`: eligible for the next cycle.
- `in-progress`: currently being implemented or verified.
- `blocked`: cannot proceed; the reason must be recorded below.
- `complete`: implemented, verified, committed, and pushed.

## Blockers and notes

Record dated blockers, CI failures, and material scope decisions here.

- 2026-08-06: Feature 1 completed. Worker production dispatch now uses Android Management API application-default credentials, retries transient connector failures, preserves safe stub mode, and records dispatch audit outcomes. Full verification passed with a validation-only placeholder `DATABASE_URL`.
