# Codex app feature delivery

Feature delivery is orchestrated by the persistent Codex app task, using the user's Codex session. It does not require or expose an OpenAI API key.

## Cycle

1. Select the first `ready` entry in `CODEX_FEATURE_BACKLOG.md`.
2. Mark it `in-progress` and inspect the relevant implementation and requirements.
3. Implement only that feature, including tests and operational documentation.
4. Run the checks required by `AGENTS.md` plus feature-specific verification.
5. If verification passes, mark the feature `complete`, commit the isolated change, and push it to GitHub.
6. Confirm that GitHub CI has started. The next Codex continuation checks CI before selecting another feature.
7. If verification or CI fails, keep that feature active, diagnose it, and do not advance the queue.

GitHub Actions remains the independent verifier. The Codex app task owns implementation and Git delivery; GitHub Actions does not run an AI coding agent.

## Safety rules

- Process only one feature per cycle.
- Never push a feature with failing required checks.
- Never skip a blocked feature silently; record the blocker and stop the queue.
- Keep feature commits isolated and reversible.
- Do not store credentials in the repository or automation prompt.
