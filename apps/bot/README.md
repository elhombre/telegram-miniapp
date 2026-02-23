# Bot (grammY)

Telegram bot runtime for Phase-2.

## Features

- `/start` command
- menu button registration (`web_app`)
- inline web app launch button
- start payload parsing with TTL checks (`flow`, `ref`, `campaign`, `entityId`, `ts`)
- payload/deep-link generation via `/link`
- `polling` mode (local)
- `webhook` mode (production)

## Environment

Copy `.env.example` to `.env` and set at least:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_MINIAPP_URL`

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
