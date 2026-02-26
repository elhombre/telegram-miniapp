# Telegram Mini App Monorepo

Demo monorepo for Telegram Mini App + Web frontend + Backend API + Telegram bot.

## AI-Driven Development

This project was fully designed and implemented using AI-assisted development workflows, with human steering for product decisions, prioritization, and acceptance criteria.

## Live Demo

- [![Telegram](https://img.shields.io/badge/Telegram-Bot-blue?logo=telegram)](https://t.me/MiniAppStarterBot)
- [Web version](https://telegram-miniapp-frontend-xi.vercel.app)

## Stack

- Monorepo: Turborepo
- Package manager: Yarn 4 (`yarn@4.9.4`)
- Frontend: Next.js (`apps/frontend`)
- Backend: NestJS + Prisma + Postgres (`apps/backend`)
- Bot: grammY (`apps/bot`)
- Lint/format: Biome

## Repository Layout

- `apps/frontend`: web and mini app frontend
- `apps/backend`: API and auth core
- `apps/bot`: Telegram bot runtime
- `packages/typescript-config`: shared TS configs
- `docker-compose.yml`: local infra/app services via profiles (`infra`, `app`)
- `docs/`: canonical project documentation

## Prerequisites

- Node.js 20+
- Corepack enabled (`corepack enable`)
- Docker Desktop (optional, for local infra/app containers)
- Telegram account for bot setup

## Quick Start

1. Install dependencies:

```bash
cd code
corepack yarn install
```

1. Create env files:

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/bot/.env.example apps/bot/.env
```

1. Fill required env values:

- root `.env`
  - `POSTGRES_*`
  - `REDIS_PORT`, `REDIS_PASSWORD`
  - `BACKEND_PORT` (must match `apps/backend/.env:PORT`)
  - `BOT_WEBHOOK_PORT` (must match `apps/bot/.env:TELEGRAM_WEBHOOK_PORT`)
- `apps/backend/.env`
  - `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - `PORT`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_LINK_SECRET`
  - `GOOGLE_CLIENT_ID` (must match frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
- `apps/frontend/.env`
  - `NEXT_PUBLIC_API_MODE`
  - `BACKEND_API_BASE_URL` (for proxy mode)
- `apps/bot/.env`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MINIAPP_URL`
  - `BACKEND_HOST`, `BACKEND_PORT`
  - `TELEGRAM_BOT_LINK_SECRET`

1. Start infrastructure:

```bash
docker compose --profile infra up -d postgres redis
```

1. Run database migrations:

```bash
corepack yarn workspace backend prisma:migrate:deploy
```

## Run Locally

Use three terminals from `code/`:

```bash
corepack yarn workspace backend dev
corepack yarn workspace frontend dev
corepack yarn workspace bot dev
```

Default URLs:

- backend: `http://localhost:3000/api/v1`
- frontend: `http://localhost:3100`

### Run Frontend Dev Server

From `code/`:

```bash
corepack yarn workspace frontend dev
```

Then open `http://localhost:3100`.
For full end-to-end Mini App flow, run backend, frontend, and bot together (see `Run Locally` above).

## Run Backend + Bot in Docker

```bash
docker compose --profile app up -d --build backend bot
docker compose logs -f backend bot
```

For Docker run:

- `apps/backend/.env:DATABASE_URL` should use docker host `postgres`.
- If Redis rate limiting is used, `apps/backend/.env:REDIS_URL` should use docker host `redis`.
- Keep root `.env:BACKEND_PORT` and `apps/backend/.env:PORT` in sync.

Frontend is not started via `docker compose` in this repo by default.
The production frontend is deployed separately (Vercel).

## Documentation

Detailed guides are in [`docs/`](./docs/README.md):

- [Smoke Tests](./docs/smoke-tests.md)
- [UI Guide](./docs/ui-guide.md)
- [Bot Guide](./docs/bot-guide.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Development](./docs/development.md)
