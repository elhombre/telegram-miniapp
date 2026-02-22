# Development

## Commands Cheat Sheet

Monorepo level:

```bash
yarn dev
yarn build
yarn lint
yarn check-types
```

App level:

```bash
yarn workspace backend dev
yarn workspace backend prisma:migrate:deploy
yarn workspace frontend dev
yarn workspace bot dev
yarn workspace bot dev:webhook
```

## Workflow Notes

- For frontend API integrations, keep `proxy` mode as baseline and add explicit endpoint mappings in `apps/frontend/lib/api.ts`.
- When backend API contract changes, update API docs/assets in the same change.
- Keep `.env` files out of VCS.
- Do not store real bot tokens in commits.
