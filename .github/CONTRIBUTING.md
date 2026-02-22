# Contributing

## Workflow

1. Create a feature branch from `main`.
2. Keep changes scoped to one concern.
3. Update docs and tests in the same PR when behavior changes.
4. Use Conventional Commits for commit messages.

## Local checks

Run from `code/` before opening a PR:

```bash
yarn lint
yarn workspace frontend check-types
yarn workspace bot check-types
yarn workspace backend build
yarn workspace backend test:e2e
```

## Pull Requests

- Fill in the PR template.
- Describe risks and rollback.
- Attach screenshots for UI changes.
- Mention required env vars for new integrations.

## Coding standards

- Keep backend contracts backward-compatible unless explicitly planned.
- Do not commit secrets.
- Prefer small, reviewable diffs.
