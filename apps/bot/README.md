# Bot (grammY)

Telegram bot runtime for Phase-2.

## Features

- `/start` command
- menu button registration (`web_app`)
- inline web app launch button
- explicit link confirmation button for Telegram linking flow
- launch URL marker `miniapp=1` for stable frontend miniapp mode detection
- start payload parsing with TTL checks (`flow`, `ref`, `campaign`, `entityId`, `ts`)
- payload/deep-link generation via `/link`
- telegram linking confirmation via bot button callback (`/start` payload with `linkToken`)
- `polling` mode (local)
- `webhook` mode (production)

## Environment

Copy `.env.example` to `.env` and set at least:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_MINIAPP_URL`
- `BACKEND_PORT` (must match backend `PORT`)
- `BACKEND_HOST` (`localhost` for local run, `backend` for docker compose)
- `TELEGRAM_BOT_LINK_SECRET` (must match backend `TELEGRAM_BOT_LINK_SECRET`)

Link confirmation button label is localized automatically:

- `ru*` -> `Связать аккаунт`
- fallback -> `Link account`

For webhook mode also set:

- `TELEGRAM_WEBHOOK_BASE_URL`
- `TELEGRAM_WEBHOOK_SECRET`

Optional deep-link URL generation:

- `TELEGRAM_MINIAPP_SHORT_NAME`

## Run

```bash
# long polling (local)
yarn workspace bot dev

# webhook mode (local process, public URL required)
yarn workspace bot dev:webhook
```

## Build

```bash
yarn workspace bot check-types
yarn workspace bot build
```
