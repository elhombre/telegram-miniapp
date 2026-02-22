# Smoke Tests

## Mini App Auth Smoke Test

Goal: verify Telegram Mini App auth is validated on backend and frontend receives auth session.

Preconditions:

1. `apps/bot/.env` has valid `TELEGRAM_BOT_TOKEN`.
2. `apps/backend/.env` has the same value in `TELEGRAM_BOT_TOKEN`.
3. `TELEGRAM_MINIAPP_URL` points to the frontend URL that is opened inside Telegram.

Backend and frontend config checklist:

1. `apps/backend/.env`
   - `TELEGRAM_BOT_TOKEN=<same token as apps/bot/.env>`
   - `FRONTEND_ORIGIN=<public frontend origin opened in Telegram>`
2. `apps/frontend/.env`
   - `NEXT_PUBLIC_API_MODE=proxy|direct`
   - `BACKEND_API_BASE_URL=<backend API base URL>/api/v1` (for `proxy` mode)
   - `NEXT_PUBLIC_DIRECT_API_BASE_URL=<backend API base URL>/api/v1` (for `direct` mode)

Example local tunneling:

```bash
ngrok http 3100
```

Then set:

- `apps/bot/.env` -> `TELEGRAM_MINIAPP_URL=https://<frontend-tunnel>.ngrok-free.app`
- `apps/backend/.env` -> `FRONTEND_ORIGIN=https://<frontend-tunnel>.ngrok-free.app`
- `apps/frontend/.env` -> `NEXT_PUBLIC_API_MODE=proxy` and `BACKEND_API_BASE_URL=http://localhost:3000/api/v1`

Steps:

1. Start backend, frontend, and bot.
2. Open bot chat in Telegram.
3. Send `/start`.
4. Open Mini App from the button.
5. Verify Welcome page loads and Telegram bootstrap auth succeeds.
6. Open `/dashboard` and verify session/user/provider data is visible.

## Web Auth Smoke Test

Goal: verify standalone web frontend can register/login with email and authenticate via Google.

Preconditions:

1. Backend is running.
2. Frontend is running.
3. `apps/frontend/.env` has valid API mode setup:
   - recommended local: `NEXT_PUBLIC_API_MODE=proxy`
   - `BACKEND_API_BASE_URL=http://localhost:3000/api/v1`
4. For Google flow:
   - `apps/backend/.env` -> `GOOGLE_CLIENT_ID=<your-google-oauth-client-id>`
   - `apps/frontend/.env` -> `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-client-id>`
5. For Telegram linking from browser:
   - `apps/frontend/.env` has `NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME=<bot_public_name>`
   - `apps/backend/.env` has `TELEGRAM_BOT_LINK_SECRET=<shared_secret>`
   - `apps/bot/.env` has:
     - `TELEGRAM_MINIAPP_URL=<miniapp_url>`
     - `BACKEND_PORT=3000`
     - `BACKEND_HOST=localhost`
     - `TELEGRAM_BOT_LINK_SECRET=<same_shared_secret_as_backend>`

Steps:

1. Open `/auth/register` and create a user.
2. Open `/auth/login` and sign in.
3. Open `/auth/google`, complete Google sign-in, and confirm redirect to `/`.
4. Open `/dashboard` and verify provider/session info.
5. Open `/dashboard/linking` and verify linking flows (`google`, `email`, `telegram`).
6. Open `/dashboard/notes`, create and delete a note.

Notes:

- `EMAIL_PROVIDER=console` logs verification payload as `auth_email_link_verification`.
- `EMAIL_PROVIDER=mailerlite` sends verification email through MailerLite API.
- Link endpoints require bearer access token.
- Auth/link endpoints are rate-limited on backend.

## Rate Limiting Smoke Test

Goal: verify auth rate limiting is active and counters are stored in Redis.

Preconditions:

1. `apps/backend/.env` has:
   - `RATE_LIMIT_ENABLED=true`
   - `REDIS_URL=redis://:redis@localhost:6379/0` (or managed Redis URL)
2. `docker compose --profile infra up -d redis` is running.
3. Backend is running.

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
- then responses switch to `429`

2. Verify Redis key exists:

```bash
redis-cli -u "$REDIS_URL" --scan --pattern "rl:email_login_ip_email:*:ratetest@example.com"
```
