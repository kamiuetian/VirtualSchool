# Autonomous feature delivery

The `Autonomous feature cycle` GitHub Actions workflow processes one GitHub issue at a time.

## Repository setup

1. Add an OpenAI API key as the repository Actions secret `OPENAI_API_KEY`.
2. Create the labels `agent:ready`, `agent:in-progress`, and `agent:generated`.
3. Protect `main` and require the `CI` checks before merge. Do not require a human review if the fully autonomous merge cycle is desired.
4. Add feature issues in priority order. Each issue must contain a bounded scope, acceptance criteria, explicit exclusions, and relevant verification expectations.
5. Apply `agent:ready` only when an issue is sufficiently specified for autonomous implementation.

## Cycle

1. Run `Autonomous feature cycle` manually once to start the queue.
2. The workflow claims the oldest open `agent:ready` issue.
3. Codex implements and verifies only that issue in an isolated runner checkout.
4. A separate job packages and pushes the resulting patch to `codex/feature-<issue-number>` and opens a pull request.
5. GitHub CI verifies the pull request. If every CI job passes, `Autonomous feature merge` squash-merges it automatically.
6. The merge closes the feature issue and triggers the workflow for the next ready issue.

The cycle deliberately waits for full CI rather than writing directly to `main`. Failed implementation or publication returns the issue to `agent:ready` and records a comment on the issue. Failed PR CI stops the queue and leaves the PR open for diagnosis; fixing the branch or rerunning CI successfully resumes automatic merging.

## Feature issue template

```markdown
## Outcome

Describe one user-visible or operational outcome.

## Acceptance criteria

- Observable requirement one
- Observable requirement two
- Tests or documentation required

## Out of scope

- Closely related work that must not be included

## Verification

- Additional feature-specific checks beyond AGENTS.md
```

Do not put secrets, credentials, or instructions to weaken repository security in issue content.
