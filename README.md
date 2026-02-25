# Telegram Mini App Monorepo

Production-first monorepo for Telegram Mini App + Web frontend + Backend API + Telegram bot.

## AI-Driven Development

This project was fully designed and implemented using AI-assisted development workflows, with human steering for product decisions, prioritization, and acceptance criteria.

## Stack

- Monorepo: Turborepo
- Package manager: Yarn 4 (PnP)
- Frontend: Next.js (`apps/frontend`)
- Backend: NestJS + Prisma + Postgres (`apps/backend`)
- Bot: grammY (`apps/bot`)
- Lint/format: Biome

## Repository Layout

- `apps/frontend`: web and mini app frontend
- `apps/backend`: API and auth core
- `apps/bot`: Telegram bot runtime
- `packages/ui`: shared UI package
- `packages/typescript-config`: shared TS configs
- `docker-compose.yml`: local infrastructure (`postgres`, `redis`)

## Delivery Status

- Phases 0-4 are implemented.
- Current focus is Phase 5 (hardening and release readiness).

## Prerequisites

- Node.js 20+
- Yarn 4+ (project uses `yarn@4.9.4`)
- Docker Desktop (for local Postgres and Redis)
- Telegram account for bot setup

## Initial Setup

1. Install dependencies.

```bash
cd code
yarn install
```

1. Create env files.

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/bot/.env.example apps/bot/.env
```

1. Fill required secrets.

- root `.env`
  - `POSTGRES_*` values for local compose Postgres
  - `REDIS_PORT`
  - `REDIS_PASSWORD` (password for local compose Redis)
- `apps/backend/.env`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `TELEGRAM_BOT_TOKEN` (must match `apps/bot/.env`)
  - `TELEGRAM_BOT_LINK_SECRET` (must match `apps/bot/.env`)
  - `GOOGLE_CLIENT_ID` (must match frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
  - `NOTES_MAX_LENGTH` (optional, default `2000`)
  - optional email delivery settings:
    - `EMAIL_PROVIDER=mailerlite`
    - `MAILERLITE_TOKEN=<your_mailerlite_token>`
    - `EMAIL_FROM_EMAIL=<verified_sender_email>`
    - `EMAIL_FROM_NAME=<sender_name>`
  - optional distributed rate limiting:
    - `RATE_LIMIT_ENABLED=true`
    - `REDIS_URL=redis://<user>:<password>@<host>:<port>/<db>` (or `rediss://...`)
    - Works with any Redis-compatible backend.
    - local docker-compose defaults:
      - root `.env`: `REDIS_PASSWORD=redis`
      - backend `.env`: `REDIS_URL=redis://:redis@localhost:6379/0`
- `apps/bot/.env`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_MINIAPP_URL`
  - `BACKEND_API_BASE_URL`
  - `TELEGRAM_BOT_LINK_SECRET`

1. Start local infrastructure services.

```bash
docker compose up -d postgres redis
```

1. Apply database migrations.

```bash
yarn workspace backend prisma:migrate:deploy
```

## Run Locally

Open 3 terminals from `code/`.

Terminal 1, backend:

```bash
yarn workspace backend dev
```

Terminal 2, frontend:

```bash
yarn workspace frontend dev
```

Terminal 3, bot in polling mode:

```bash
yarn workspace bot dev
```

Default URLs:

- backend: `http://localhost:3000/api/v1`
- frontend: `http://localhost:3100`

## Mini App Auth Smoke Test

Goal: verify Telegram Mini App auth is validated on backend and frontend receives auth session.

Preconditions:

1. `apps/bot/.env` has valid `TELEGRAM_BOT_TOKEN`.
2. `apps/backend/.env` has the same value in `TELEGRAM_BOT_TOKEN`.
3. `TELEGRAM_MINIAPP_URL` points to the frontend URL that is actually opened inside Telegram.

Backend and frontend config checklist for this test:

1. `apps/backend/.env`
   - `TELEGRAM_BOT_TOKEN=<same token as apps/bot/.env>`
   - `FRONTEND_ORIGIN=<public frontend origin opened in Telegram>`
     - example: `https://<frontend-tunnel>.ngrok-free.app`
2. `apps/frontend/.env`
   - `NEXT_PUBLIC_API_MODE=proxy|direct`
     - default is `proxy`
     - `proxy`: browser calls frontend routes under `POST /api/auth/*` (server-side proxy)
     - `direct`: browser calls backend URL directly
   - `BACKEND_API_BASE_URL=<backend API base URL>/api/v1` (used in `proxy` mode by Next.js server)
     - this value is private (not exposed to browser)
     - local example: `http://localhost:3000/api/v1`
   - `NEXT_PUBLIC_DIRECT_API_BASE_URL=<backend API base URL>/api/v1` (used in `direct` mode by browser)
     - must be reachable from the client device
     - example: `https://api.example.com/api/v1`

Example local tunneling setup:

```bash
# frontend tunnel
ngrok http 3100
```

Then set:

- `apps/bot/.env` -> `TELEGRAM_MINIAPP_URL=https://<frontend-tunnel>.ngrok-free.app`
- `apps/backend/.env` -> `FRONTEND_ORIGIN=https://<frontend-tunnel>.ngrok-free.app`
- `apps/frontend/.env` (recommended for Mini App)
  - `NEXT_PUBLIC_API_MODE=proxy`
  - `BACKEND_API_BASE_URL=http://localhost:3000/api/v1`

Optional for standalone web frontend direct mode:

- `apps/frontend/.env`
  - `NEXT_PUBLIC_API_MODE=direct`
  - `NEXT_PUBLIC_DIRECT_API_BASE_URL=https://<backend-public-domain>/api/v1`

Steps:

1. Start backend, frontend, and bot (polling is enough for this test).
2. Open bot chat in Telegram.
3. Send `/start`.
4. Open Mini App from the button.
5. On Welcome screen, verify:
   - app opens without errors
   - Telegram bootstrap auth runs automatically (inside Telegram)
6. Open `/dashboard` and verify:
   - active session is visible
   - user and provider data are shown

## Web Auth Smoke Test

Goal: verify standalone web frontend can register/login with email and authenticate via Google.

Preconditions:

1. Backend is running (`yarn workspace backend dev`).
2. Frontend is running (`yarn workspace frontend dev`).
3. `apps/frontend/.env` has valid API mode setup:
   - recommended local: `NEXT_PUBLIC_API_MODE=proxy`
   - `BACKEND_API_BASE_URL=http://localhost:3000/api/v1`
4. For Google flow:
   - `apps/backend/.env` has `GOOGLE_CLIENT_ID=<your-google-oauth-client-id>`
   - `apps/frontend/.env` has `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-client-id>`
5. For Telegram linking from browser (bot flow):
   - `apps/frontend/.env` has
     `NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME=<public_bot_name_from_t.me_link_without_@>`
   - `apps/backend/.env` has `TELEGRAM_BOT_LINK_SECRET=<shared_secret>`
   - `apps/bot/.env` has:
     - `TELEGRAM_MINIAPP_URL=<miniapp_url>`
     - `BACKEND_API_BASE_URL=http://localhost:3000/api/v1`
     - `TELEGRAM_BOT_LINK_SECRET=<same_shared_secret_as_backend>`
   - bot process is running (`yarn workspace bot dev`)

How to get `GOOGLE_CLIENT_ID`:

1. Open Google Cloud Console and select/create project.
2. Configure OAuth consent screen (app name, user support email, and test users if app is in testing mode).
3. Go to Credentials -> Create Credentials -> OAuth client ID.
4. Choose application type `Web application`.
5. Add `Authorized JavaScript origins`:
   - `http://localhost:3100`
   - your public frontend URL (for example ngrok/Vercel domain), if you test outside localhost
6. Copy generated Client ID and use the same value in:
   - `apps/backend/.env` -> `GOOGLE_CLIENT_ID`
   - `apps/frontend/.env` -> `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

Important:

- For current ID-token callback flow, Client Secret is not used on frontend.
- Backend and frontend must use the same Client ID, otherwise backend returns `INVALID_GOOGLE_TOKEN`.

Steps:

1. Open `http://localhost:3100/auth/register`.
2. Register with email and password (min length 8).
3. Confirm app redirects to `http://localhost:3100/` and session is active.
4. Open `http://localhost:3100/auth/login`.
5. Sign in with same credentials and confirm app redirects to `http://localhost:3100/`.
6. Open `http://localhost:3100/auth/google`.
7. Click Google sign-in button and select account.
8. Confirm selected account is shown on the page, then click `Sign in`.
9. Confirm app redirects to `http://localhost:3100/` and session is active.
10. Open `http://localhost:3100/dashboard` and confirm provider/session info is shown.
11. Open `http://localhost:3100/dashboard/linking` and run account linking:

- linking is available only in standalone browser (disabled inside Telegram
     Mini App)
- available providers depend on current sign-in provider:
  - signed in with `google`: `email`, `telegram`
  - signed in with `email`: `google`, `telegram`
  - signed in with `telegram`: `email`, `google` (mainly test/dev scenario
       for standalone web)
- `google`: click Google button in linking section and select account, then
     click `Confirm and link Google` to submit linking
- `email`: fill email, click `Send Verification Code`, then enter 6-digit
     code and click `Confirm Code & Link`
- `telegram`: click `Open Telegram and continue`, then press `Start` in bot
     chat, then press the confirmation button shown by the bot (label is
     localized automatically) and wait until browser shows Telegram linked
     confirmation (the bot now uses compact start payload format
     `l_<linkToken>`)
- when Telegram is linked, Profile card shows `Unlink Telegram` action
     (available only in standalone web)

12. Open `http://localhost:3100/dashboard/notes` and verify notes flow:

- create a text note
- verify it appears in list with created date/time
- delete the note and verify it disappears from the list

Notes:

- Email linking now uses verification code flow.
- `EMAIL_PROVIDER=console` logs verification payload as `auth_email_link_verification`.
- `EMAIL_PROVIDER=mailerlite` sends verification email through MailerLite API.
- Link endpoints require bearer access token, so run linking after successful auth.
- Telegram unlink is available only in standalone web profile and is blocked if
  it would remove the last remaining sign-in provider.
- Auth/link endpoints are rate-limited on backend.
  - if `REDIS_URL` is configured, shared counters are stored in Redis
  - if Redis is unavailable (or `REDIS_URL` is empty), backend falls back to in-memory counters and logs warning

## Rate Limiting Smoke Test

Goal: verify auth rate limiting is active and counters are stored in Redis.

Preconditions:

1. `apps/backend/.env` has:
   - `RATE_LIMIT_ENABLED=true`
   - `REDIS_URL=redis://:redis@localhost:6379/0` (or your managed Redis URL)
2. `docker compose up -d redis` is running from `code/`.
3. Backend is running (`yarn workspace backend dev`).

Steps:

1. Send repeated failed email login attempts:

```bash
for i in 1 2 3 4 5 6 7; do
  curl -s -o /dev/null -w "$i -> %{http_code}\n" \
    -X POST http://127.0.0.1:3000/api/v1/auth/email/login \
    -H 'content-type: application/json' \
    -d '{"email":"ratetest@example.com","password":"WrongPass123"}'
done
```

Expected:

- first attempts return `401`
- then responses switch to `429` when `email_login_ip_email` limit is exceeded

1. Verify Redis key exists:

```bash
redis-cli -u "$REDIS_URL" --scan --pattern "rl:email_login_ip_email:*:ratetest@example.com"
```

## UI Guide

- UI is shared between standalone web and Telegram Mini App.
- Header brand label is `Demo`; click it to navigate to `/`.
- UI stack is based on `shadcn/ui` + Tailwind CSS.
- i18n is enabled with locale dictionaries: `en`, `ru`.
- Common top-level routes:
  - `/` -> Welcome
  - `/dashboard/notes` -> Notes
  - `/dashboard` -> Profile
  - `/dashboard/linking` -> Account linking (opened from profile action buttons,
    no dedicated navigation tab)
- Active navigation highlighting is section-based:
  - `/dashboard/notes` highlights only `Notes`
  - `/dashboard` (and other `/dashboard/*` pages except notes) highlights
    `Profile`

### Standalone Web Mode

- Header contains:
  - desktop top navigation (`Welcome`, `Notes`, `Profile`)
  - language switcher (`EN`/`RU`)
  - theme toggle (3-state cycle: `light -> dark -> system`)
  - auth controls:
    - unauthenticated: `Sign in`, `Register`
    - authenticated: user icon menu with `Profile` and `Sign out`
- Welcome page shows auth CTA buttons for unauthenticated users.
- Profile page (`/dashboard`) includes provider cards.
- Linking page (`/dashboard/linking`) contains account linking panel.
- Telegram provider card supports unlink action with confirmation dialog.

### Telegram Mini App Mode

- Header keeps only global controls (language + theme); web auth controls are hidden.
- Bottom navigation is used for section switching (`Welcome`, `Notes`, `Profile`).
- Mini App applies safe-area paddings for top and bottom system insets.
- Welcome page starts Telegram bootstrap auth automatically.
- Account linking actions are disabled in Mini App UI (browser-only flow).
- Unlink actions are also disabled in Mini App UI.

## Bot Guide (Detailed)

### 1. Register Bot in Telegram

Use BotFather in Telegram.

1. Open `@BotFather`.
2. Run `/newbot`.
3. Set bot name and username.
4. Copy generated token.
5. Put token into `apps/bot/.env` as `TELEGRAM_BOT_TOKEN`.

Optional hardening:

- If token leaked, run `/revoke` in BotFather and update env.
- If you use Telegram Login Widget in custom flows, run `/setdomain` in
  BotFather and set your frontend domain (`example.com`, no path).

### 2. Configure Mini App URL

Set `TELEGRAM_MINIAPP_URL` in `apps/bot/.env`.

Important:

- Telegram clients require a public `https://` URL for Mini App.
- `http://localhost:3100` is not usable directly inside Telegram clients.

Local testing options:

1. Run frontend locally (`yarn workspace frontend dev`).
2. Expose it via tunnel (for example ngrok/cloudflared).
3. Set `TELEGRAM_MINIAPP_URL` to tunnel HTTPS URL.

Example with ngrok:

```bash
ngrok http 3100
# set TELEGRAM_MINIAPP_URL=https://<your-id>.ngrok-free.app
```

### 3. Menu Button and Commands

On bot startup, app configures automatically:

- commands: `/start`, `/link`
- chat menu button (`web_app`) using:
  - `TELEGRAM_MENU_BUTTON_TEXT`
  - `TELEGRAM_MINIAPP_URL`
- bot launch URLs include a Mini App marker for stable frontend mode detection

You normally do not need manual BotFather setup for menu button if bot is running and can call Telegram API.

### 4. Optional Startapp Deep Link

If you want direct link format `https://t.me/<bot>/<mini_app_short_name>?startapp=...`:

1. Create Mini App short name in BotFather (Mini App/Web App flow).
2. Put it into `TELEGRAM_MINIAPP_SHORT_NAME`.
3. Run `/link` in bot chat to get generated deep link.

### 5. Local Mode: Polling

Use polling for local development.

`apps/bot/.env`:

- `BOT_MODE=polling`

Run:

```bash
yarn workspace bot dev
```

Test flow:

1. Open chat with your bot.
2. Send `/start`.
3. Click inline `web_app` button.

### 6. Local Mode: Webhook (Optional)

Use when you want to test webhook behavior locally.

Required env in `apps/bot/.env`:

- `BOT_MODE=webhook`
- `TELEGRAM_WEBHOOK_BASE_URL=https://<public-domain>`
- `TELEGRAM_WEBHOOK_PATH=/telegram/webhook`
- `TELEGRAM_WEBHOOK_SECRET=<strong-random-value>`
- `TELEGRAM_WEBHOOK_PORT=3200`

Run:

```bash
yarn workspace bot dev:webhook
```

Expose bot webhook port (or reverse proxy to it) on public HTTPS URL so Telegram can reach it.

Health endpoint in webhook mode:

- `GET /healthz`

### 7. Production Server Mode (Webhook)

Recommended for real deployment.

1. Deploy frontend to public HTTPS.
2. Deploy backend API.
3. Deploy bot process with `BOT_MODE=webhook`.
4. Set production env values in `apps/bot/.env`.
5. Run bot:

```bash
yarn workspace bot build
yarn workspace bot start:webhook
```

Typical reverse proxy routing:

- public `https://bot.example.com/telegram/webhook` -> bot container/process `0.0.0.0:3200/telegram/webhook`

Verify webhook status:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Reset webhook when switching from webhook to polling:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook?drop_pending_updates=true"
```

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

## Troubleshooting

- Bot does not receive updates in polling mode.
  - Ensure webhook is deleted (`deleteWebhook`).
- Telegram cannot open Mini App.
  - Check `TELEGRAM_MINIAPP_URL` is public HTTPS.
- Telegram linking does not confirm in browser.
  - In Telegram chat with bot, press `Start`, then press the confirmation
    button shown by the bot (label is localized automatically).
  - Ensure `TELEGRAM_BOT_LINK_SECRET` is identical in `apps/backend/.env` and `apps/bot/.env`.
  - Ensure `apps/bot/.env:BACKEND_API_BASE_URL` points to backend API prefix (example: `http://localhost:3000/api/v1`).
  - If bot shows `Link failed: Bot backend linking integration is not configured`,
    check both vars above and restart bot process.
  - Wait until bot shows `Telegram account linked successfully`, then wait for browser status update.
  - Keep the browser linking page open until status changes to success.
- Telegram auth endpoint returns signature/authorization error.
  - Ensure `apps/backend/.env:TELEGRAM_BOT_TOKEN` matches `apps/bot/.env:TELEGRAM_BOT_TOKEN`.
- Webhook returns unauthorized.
  - Check `TELEGRAM_WEBHOOK_SECRET` and forwarded header `x-telegram-bot-api-secret-token`.
- Backend DB issues.
  - Re-run compose + migrations and verify tables. See `../docs/runbooks/backend-phase1-db-verification.md`.
- Rate limiting with Redis seems inactive.
  - Ensure `RATE_LIMIT_ENABLED=true` and `REDIS_URL` is configured.
  - Ensure backend startup logs include `rate_limit_store_selected` with `provider=redis`.
  - Verify keys exist in Redis after repeated auth attempts:
    - `redis-cli -u "$REDIS_URL" --scan --pattern "rl:*"`

## Development Process

- Use `../docs/runbooks/development-workflow.md` as the default change checklist.
- For frontend API integrations, keep `proxy` mode as baseline and add explicit endpoint mappings in `apps/frontend/lib/api.ts`.
- When backend API contract changes, update docs and Postman assets in the same change.

## Notes

- Keep `.env` files out of VCS.
- Do not store real bot tokens in commits.
- Update docs and Postman assets together with API contract changes.
