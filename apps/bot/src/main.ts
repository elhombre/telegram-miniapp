import 'dotenv/config'
import { createServer } from 'node:http'
import { Bot, InlineKeyboard, webhookCallback } from 'grammy'
import { buildMiniAppUrl, buildStartAppDeepLink, generateStartPayload, parseStartPayload } from './bot/start-payload.js'
import { getBotEnv } from './config/env.js'

const env = getBotEnv()
const bot = new Bot(env.TELEGRAM_BOT_TOKEN)
const LINK_CALLBACK_PREFIX = 'link_confirm:'
const LINK_TOKEN_REGEX = /^[A-Za-z0-9_-]{16,128}$/

bot.catch(error => {
  const message = error.error instanceof Error ? error.error.message : String(error.error)

  console.error(
    JSON.stringify({
      event: 'bot_update_failed',
      message,
    }),
  )
})

bot.command('start', async ctx => {
  const botUsername = ctx.me.username
  const rawPayload = extractStartPayload(ctx.message?.text)
  const parseResult = parseStartPayload(rawPayload, env.TELEGRAM_START_PAYLOAD_TTL_SECONDS)

  if (parseResult.error) {
    await ctx.reply(`Invalid start payload: ${parseResult.error}`)
    return
  }

  const miniAppUrl = buildMiniAppUrl(env.TELEGRAM_MINIAPP_URL, parseResult.payload)
  const launchKeyboard = new InlineKeyboard().webApp(env.TELEGRAM_MENU_BUTTON_TEXT, miniAppUrl)

  const payloadExample = generateStartPayload({
    flow: 'home',
    ref: 'bot_start',
    campaign: 'organic',
    entityId: 'profile',
  })

  const deepLink = buildStartAppDeepLink(botUsername, env.TELEGRAM_MINIAPP_SHORT_NAME, payloadExample)

  if (parseResult.payload?.linkToken) {
    const callbackData = `${LINK_CALLBACK_PREFIX}${parseResult.payload.linkToken}`
    const confirmKeyboard = new InlineKeyboard().text(getLinkConfirmButtonText(ctx.from?.language_code), callbackData)
    await ctx.reply('To complete linking, press the button below.', {
      reply_markup: confirmKeyboard,
    })
    return
  }

  const details: string[] = [
    'Mini App is ready.',
    `Launch URL: ${miniAppUrl}`,
    `Payload example: ${payloadExample}`,
  ]

  if (deepLink) {
    details.push(`Startapp link: ${deepLink}`)
  }

  await ctx.reply(details.join('\n'), {
    reply_markup: launchKeyboard,
  })
})

bot.command('link', async ctx => {
  const payload = generateStartPayload({
    flow: 'home',
    ref: 'manual',
    campaign: 'bot_link',
    entityId: 'profile',
  })

  const deepLink = buildStartAppDeepLink(ctx.me.username, env.TELEGRAM_MINIAPP_SHORT_NAME, payload)

  if (!deepLink) {
    await ctx.reply(
      `Set TELEGRAM_MINIAPP_SHORT_NAME to generate a direct startapp deep link. Payload: ${payload}`,
    )
    return
  }

  await ctx.reply(`Startapp deep link:\n${deepLink}`)
})

bot.callbackQuery(new RegExp(`^${LINK_CALLBACK_PREFIX}(.+)$`), async ctx => {
  const linkToken = ctx.match?.[1]?.trim()
  if (!linkToken || !LINK_TOKEN_REGEX.test(linkToken) || !ctx.from) {
    await ctx.answerCallbackQuery({
      text: 'Invalid linking payload',
      show_alert: true,
    })
    return
  }

  const linkResult = await confirmTelegramLinkViaBackend(linkToken, ctx.from)

  if (!linkResult.success) {
    await ctx.answerCallbackQuery({
      text: `Link failed: ${linkResult.message}`,
      show_alert: true,
    })
    return
  }

  await ctx.answerCallbackQuery({
    text: 'Linked successfully',
    show_alert: false,
  })

  const miniAppUrl = buildMiniAppUrl(env.TELEGRAM_MINIAPP_URL)
  const openKeyboard = new InlineKeyboard().webApp(env.TELEGRAM_MENU_BUTTON_TEXT, miniAppUrl)

  try {
    await ctx.editMessageText('Telegram account linked successfully. Return to browser.', {
      reply_markup: openKeyboard,
    })
  } catch {
    await ctx.reply('Telegram account linked successfully. Return to browser.', {
      reply_markup: openKeyboard,
    })
  }
})

async function bootstrap() {
  const me = await bot.api.getMe()

  await bot.api.setMyCommands([
    { command: 'start', description: 'Open the mini app' },
    { command: 'link', description: 'Generate startapp deep link' },
  ])

  await bot.api.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: env.TELEGRAM_MENU_BUTTON_TEXT,
      web_app: {
        url: buildMiniAppUrl(env.TELEGRAM_MINIAPP_URL),
      },
    },
  })

  if (env.BOT_MODE === 'webhook') {
    await startWebhookMode(me.username)
    return
  }

  console.log(
    JSON.stringify({
      event: 'bot_started',
      mode: 'polling',
      username: me.username,
    }),
  )

  await bot.start({
    onStart: () => {
      console.log(JSON.stringify({ event: 'bot_polling_started' }))
    },
  })
}

async function startWebhookMode(botUsername: string) {
  const webhookBaseUrl = env.TELEGRAM_WEBHOOK_BASE_URL
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET

  if (!webhookBaseUrl || !webhookSecret) {
    throw new Error('Webhook mode requires TELEGRAM_WEBHOOK_BASE_URL and TELEGRAM_WEBHOOK_SECRET')
  }

  const webhookUrl = new URL(env.TELEGRAM_WEBHOOK_PATH, webhookBaseUrl).toString()

  await bot.api.setWebhook(webhookUrl, {
    secret_token: webhookSecret,
    drop_pending_updates: false,
  })

  const handleUpdate = webhookCallback(bot, 'http')

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (requestUrl.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', mode: 'webhook' }))
      return
    }

    if (requestUrl.pathname !== env.TELEGRAM_WEBHOOK_PATH) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method Not Allowed')
      return
    }

    const receivedSecret = req.headers['x-telegram-bot-api-secret-token']
    if (receivedSecret !== webhookSecret) {
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    await handleUpdate(req, res)
  })

  server.listen(env.TELEGRAM_WEBHOOK_PORT, '0.0.0.0', () => {
    console.log(
      JSON.stringify({
        event: 'bot_started',
        mode: 'webhook',
        username: botUsername,
        webhookUrl,
        listenPort: env.TELEGRAM_WEBHOOK_PORT,
      }),
    )
  })
}

function extractStartPayload(text: string | undefined): string | undefined {
  if (!text) {
    return undefined
  }

  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) {
    return undefined
  }

  return parts.slice(1).join(' ')
}

function getLinkConfirmButtonText(languageCode: string | undefined): string {
  const normalized = languageCode?.trim().toLowerCase()

  if (normalized?.startsWith('ru')) {
    return 'Связать аккаунт'
  }

  return 'Link account'
}

async function confirmTelegramLinkViaBackend(
  linkToken: string,
  user: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
    language_code?: string
  },
): Promise<{ success: true } | { success: false; message: string }> {
  if (!env.BACKEND_API_BASE_URL || !env.TELEGRAM_BOT_LINK_SECRET) {
    return {
      success: false,
      message: 'Bot backend linking integration is not configured',
    }
  }

  const endpoint = `${env.BACKEND_API_BASE_URL.replace(/\/+$/, '')}/auth/link/telegram/bot-confirm`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bot-link-secret': env.TELEGRAM_BOT_LINK_SECRET,
      },
      body: JSON.stringify({
        linkToken,
        telegramUserId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        languageCode: user.language_code,
      }),
    })

    if (response.ok) {
      return { success: true }
    }

    const responseText = await response.text()
    const parsed = safeParseJson(responseText)
    const message = extractErrorMessage(parsed) ?? `HTTP ${response.status}`

    return {
      success: false,
      message,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function safeParseJson(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue) as unknown
  } catch {
    return rawValue
  }
}

function extractErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const message = (value as Record<string, unknown>).message
  return typeof message === 'string' && message.trim() ? message : undefined
}

void bootstrap().catch(error => {
  const message = maskTelegramToken(error instanceof Error ? error.stack ?? error.message : String(error))

  console.error(
    JSON.stringify({
      event: 'bot_bootstrap_failed',
      message,
    }),
  )

  process.exitCode = 1
})

function maskTelegramToken(value: string): string {
  return value.replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot<redacted>')
}
