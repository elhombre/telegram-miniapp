import 'dotenv/config'
import { createServer } from 'node:http'
import { Bot, InlineKeyboard, webhookCallback } from 'grammy'
import { buildMiniAppUrl, buildStartAppDeepLink, generateStartPayload, parseStartPayload } from './bot/start-payload.js'
import { getBotEnv } from './config/env.js'

const env = getBotEnv()
const bot = new Bot(env.TELEGRAM_BOT_TOKEN)

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
        url: env.TELEGRAM_MINIAPP_URL,
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

void bootstrap()
