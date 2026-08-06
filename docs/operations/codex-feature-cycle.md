# Codex app feature delivery

Feature delivery is orchestrated by a repository-scoped GitHub self-hosted runner on the development machine. The runner invokes the local Codex CLI using the user's existing ChatGPT-managed Codex authentication. It does not require or expose an OpenAI API key.

## Cycle

1. A successful GitHub `CI` workflow for a push to `main` triggers `Codex feature cycle`.
2. The runner selects the first `ready` entry in `CODEX_FEATURE_BACKLOG.md`.
3. It marks the feature `in-progress` and inspects the relevant implementation and requirements.
4. It implements only that feature, including tests and operational documentation.
5. It runs the checks required by `AGENTS.md` plus feature-specific verification.
6. If verification passes, it marks the feature `complete`, commits the isolated change, and pushes it to GitHub.
7. The push starts GitHub CI; CI success triggers the next feature cycle automatically.
8. If implementation or verification fails, no push occurs and the event chain stops for diagnosis.

The runner is registered with only the `virtualschool-codex` custom label and runs under the logged-in Windows user so it can use that user's Codex authentication. It is configured to start at Windows logon.

## Safety rules

- Process only one feature per cycle.
- Never push a feature with failing required checks.
- Never skip a blocked feature silently; record the blocker and stop the queue.
- Keep feature commits isolated and reversible.
- Do not store credentials in the repository or automation prompt.
