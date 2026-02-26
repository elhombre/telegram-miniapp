# Bot Guide

## Register Bot in Telegram

Use BotFather:

1. Open `@BotFather`
2. Run `/newbot`
3. Set bot name and username
4. Copy generated token
5. Put token into `apps/bot/.env` as `TELEGRAM_BOT_TOKEN`

Optional hardening:

- If token leaked, run `/revoke` and update env.
- For Telegram Login Widget custom flows, use `/setdomain` with your frontend domain.

## Configure Mini App URL

Set `TELEGRAM_MINIAPP_URL` in `apps/bot/.env`.

Important:

- Telegram clients require public `https://` URL.
- `http://localhost:3100` cannot be opened directly in Telegram clients.

Local testing approach:

1. Run frontend locally (`yarn workspace frontend dev`).
2. Expose via tunnel (`ngrok`, `cloudflared`).
3. Set `TELEGRAM_MINIAPP_URL` to tunnel HTTPS URL.

## Menu Button and Commands

On bot startup, app configures automatically:

- commands: `/start`, `/link`
- chat menu button (`web_app`) with:
  - `TELEGRAM_MENU_BUTTON_TEXT`
  - `TELEGRAM_MINIAPP_URL`

## Optional Startapp Deep Link

For direct link `https://t.me/<bot>/<mini_app_short_name>?startapp=...`:

1. Create Mini App short name in BotFather.
2. Put it into `TELEGRAM_MINIAPP_SHORT_NAME`.
3. Run `/link` in bot chat.

## Local Polling Mode

`apps/bot/.env`:

- `BOT_MODE=polling`

Run:

```bash
yarn workspace bot dev
```

## Local Webhook Mode

Required env:

- `BOT_MODE=webhook`
- `TELEGRAM_WEBHOOK_BASE_URL=https://<public-domain>`
- `TELEGRAM_WEBHOOK_PATH=/telegram/webhook`
- `TELEGRAM_WEBHOOK_SECRET=<strong-random-value>`
- `TELEGRAM_WEBHOOK_PORT=3200`

Run:

```bash
yarn workspace bot dev:webhook
```

Health endpoint in webhook mode: `GET /healthz`.

## Production Webhook Mode

1. Deploy frontend to public HTTPS.
2. Deploy backend API.
3. Deploy bot with `BOT_MODE=webhook`.
4. Set production env in `apps/bot/.env`.
5. Run:

```bash
yarn workspace bot build
yarn workspace bot start:webhook
```

Typical reverse proxy:

- `https://bot.example.com/telegram/webhook` -> bot `0.0.0.0:3200/telegram/webhook`

Check webhook status:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Reset webhook when switching to polling:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook?drop_pending_updates=true"
```
