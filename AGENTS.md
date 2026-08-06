# Virtual School delivery instructions

These rules apply to all automated and interactive feature work in this repository.

## Scope

- Implement only the feature described by the current GitHub issue.
- Do not bundle unrelated cleanup or dependency upgrades into a feature.
- Preserve tenant isolation, role-based permissions, audit logging, and existing API compatibility.
- Never add secrets, credentials, generated build output, or local log files to Git.

## Required verification

Run the checks relevant to every changed workspace. The default full verification is:

```bash
pnpm prisma:validate
pnpm typecheck
pnpm test
pnpm build
```

When admin behavior changes, also run:

```bash
pnpm --filter @virtual-school/admin test:e2e
```

When Android behavior changes, also run the affected Gradle lint and unit-test tasks.

## Completion standard

- Add or update tests for changed behavior.
- Update operational documentation when configuration or workflows change.
- Leave the working tree containing only the current feature's changes.
- Do not commit, push, open pull requests, or modify GitHub issues. The delivery workflow handles Git operations.
