export type NodeEnv = 'development' | 'test' | 'production'
export type BotMode = 'polling' | 'webhook'

export interface BotEnv {
  NODE_ENV: NodeEnv
  BOT_MODE: BotMode
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_MINIAPP_URL: string
  TELEGRAM_MENU_BUTTON_TEXT: string
  TELEGRAM_LINK_CONFIRM_BUTTON_TEXT: string
  TELEGRAM_START_PAYLOAD_TTL_SECONDS: number
  TELEGRAM_WEBHOOK_BASE_URL?: string
  TELEGRAM_WEBHOOK_PATH: string
  TELEGRAM_WEBHOOK_SECRET?: string
  TELEGRAM_WEBHOOK_PORT: number
  TELEGRAM_MINIAPP_SHORT_NAME?: string
  BACKEND_API_BASE_URL?: string
  TELEGRAM_BOT_LINK_SECRET?: string
}

let cachedEnv: BotEnv | undefined

export function getBotEnv(rawEnv: NodeJS.ProcessEnv = process.env): BotEnv {
  if (rawEnv === process.env && cachedEnv) {
    return cachedEnv
  }

  const errors: string[] = []

  const env: BotEnv = {
    NODE_ENV: parseEnum(rawEnv.NODE_ENV, 'NODE_ENV', ['development', 'test', 'production'], 'development', errors),
    BOT_MODE: parseEnum(rawEnv.BOT_MODE, 'BOT_MODE', ['polling', 'webhook'], 'polling', errors),
    TELEGRAM_BOT_TOKEN: parseRequiredString(rawEnv.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN', errors),
    TELEGRAM_MINIAPP_URL: parseRequiredUrl(rawEnv.TELEGRAM_MINIAPP_URL, 'TELEGRAM_MINIAPP_URL', errors),
    TELEGRAM_MENU_BUTTON_TEXT: parseNonEmptyString(
      rawEnv.TELEGRAM_MENU_BUTTON_TEXT,
      'TELEGRAM_MENU_BUTTON_TEXT',
      'Open Mini App',
      errors,
    ),
    TELEGRAM_LINK_CONFIRM_BUTTON_TEXT: parseNonEmptyString(
      rawEnv.TELEGRAM_LINK_CONFIRM_BUTTON_TEXT,
      'TELEGRAM_LINK_CONFIRM_BUTTON_TEXT',
      'Link account',
      errors,
    ),
    TELEGRAM_START_PAYLOAD_TTL_SECONDS: parsePositiveInt(
      rawEnv.TELEGRAM_START_PAYLOAD_TTL_SECONDS,
      'TELEGRAM_START_PAYLOAD_TTL_SECONDS',
      900,
      errors,
    ),
    TELEGRAM_WEBHOOK_BASE_URL: parseOptionalUrl(rawEnv.TELEGRAM_WEBHOOK_BASE_URL, 'TELEGRAM_WEBHOOK_BASE_URL', errors),
    TELEGRAM_WEBHOOK_PATH: parseWebhookPath(rawEnv.TELEGRAM_WEBHOOK_PATH, errors),
    TELEGRAM_WEBHOOK_SECRET: parseOptionalString(rawEnv.TELEGRAM_WEBHOOK_SECRET),
    TELEGRAM_WEBHOOK_PORT: parsePort(rawEnv.TELEGRAM_WEBHOOK_PORT, errors),
    TELEGRAM_MINIAPP_SHORT_NAME: parseOptionalString(rawEnv.TELEGRAM_MINIAPP_SHORT_NAME),
    BACKEND_API_BASE_URL: parseOptionalUrl(rawEnv.BACKEND_API_BASE_URL, 'BACKEND_API_BASE_URL', errors),
    TELEGRAM_BOT_LINK_SECRET: parseOptionalString(rawEnv.TELEGRAM_BOT_LINK_SECRET),
  }

  if (env.BOT_MODE === 'webhook') {
    if (!env.TELEGRAM_WEBHOOK_BASE_URL) {
      errors.push('TELEGRAM_WEBHOOK_BASE_URL is required when BOT_MODE=webhook')
    }

    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      errors.push('TELEGRAM_WEBHOOK_SECRET is required when BOT_MODE=webhook')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid bot environment variables:\n${errors.map(error => `- ${error}`).join('\n')}`)
  }

  if (rawEnv === process.env) {
    cachedEnv = Object.freeze(env)
  }

  return env
}

function parseEnum<T extends string>(
  rawValue: string | undefined,
  variableName: string,
  allowed: readonly T[],
  fallback: T,
  errors: string[],
): T {
  const value = (rawValue ?? fallback).trim() as T

  if (allowed.includes(value)) {
    return value
  }

  errors.push(`${variableName} must be one of [${allowed.join(', ')}], got "${rawValue}"`)
  return fallback
}

function parseRequiredString(rawValue: string | undefined, variableName: string, errors: string[]): string {
  const value = rawValue?.trim()

  if (!value) {
    errors.push(`${variableName} is required`)
    return ''
  }

  return value
}

function parseNonEmptyString(
  rawValue: string | undefined,
  variableName: string,
  fallback: string,
  errors: string[],
): string {
  const value = (rawValue ?? fallback).trim()

  if (!value) {
    errors.push(`${variableName} cannot be empty`)
    return fallback
  }

  return value
}

function parseRequiredUrl(rawValue: string | undefined, variableName: string, errors: string[]): string {
  const value = parseRequiredString(rawValue, variableName, errors)

  if (!value) {
    return ''
  }

  try {
    return new URL(value).toString()
  } catch {
    errors.push(`${variableName} must be a valid absolute URL, got "${rawValue}"`)
    return ''
  }
}

function parseOptionalUrl(rawValue: string | undefined, variableName: string, errors: string[]): string | undefined {
  const value = rawValue?.trim()

  if (!value) {
    return undefined
  }

  try {
    return new URL(value).toString()
  } catch {
    errors.push(`${variableName} must be a valid absolute URL, got "${rawValue}"`)
    return undefined
  }
}

function parseOptionalString(rawValue: string | undefined): string | undefined {
  const value = rawValue?.trim()
  return value ? value : undefined
}

function parsePositiveInt(rawValue: string | undefined, variableName: string, fallback: number, errors: string[]): number {
  if (!rawValue) {
    return fallback
  }

  const value = Number.parseInt(rawValue, 10)
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${variableName} must be a positive integer, got "${rawValue}"`)
    return fallback
  }

  return value
}

function parsePort(rawValue: string | undefined, errors: string[]): number {
  const fallback = 3200

  if (!rawValue) {
    return fallback
  }

  const value = Number.parseInt(rawValue, 10)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    errors.push(`TELEGRAM_WEBHOOK_PORT must be an integer between 1 and 65535, got "${rawValue}"`)
    return fallback
  }

  return value
}

function parseWebhookPath(rawValue: string | undefined, errors: string[]): string {
  const value = (rawValue ?? '/telegram/webhook').trim()

  if (!value.startsWith('/')) {
    errors.push(`TELEGRAM_WEBHOOK_PATH must start with "/", got "${rawValue}"`)
    return '/telegram/webhook'
  }

  return value
}
