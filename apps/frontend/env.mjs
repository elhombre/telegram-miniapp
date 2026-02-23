const NODE_ENV_VALUES = ['development', 'test', 'production']
const APP_ENV_VALUES = ['development', 'staging', 'production']
const API_MODE_VALUES = ['proxy', 'direct']

export function loadFrontendEnv(rawEnv = process.env) {
  const errors = []

  const nextPublicApiMode = parseEnum(
    rawEnv.NEXT_PUBLIC_API_MODE,
    'NEXT_PUBLIC_API_MODE',
    API_MODE_VALUES,
    'proxy',
    errors,
  )

  const nextPublicDirectApiBaseUrl = parseOptionalAbsoluteUrl(
    rawEnv.NEXT_PUBLIC_DIRECT_API_BASE_URL,
    'NEXT_PUBLIC_DIRECT_API_BASE_URL',
    errors,
  )

  if (nextPublicApiMode === 'direct' && !nextPublicDirectApiBaseUrl) {
    errors.push('NEXT_PUBLIC_DIRECT_API_BASE_URL is required when NEXT_PUBLIC_API_MODE=direct')
  }

  const frontendEnv = {
    NODE_ENV: parseEnum(
      rawEnv.NODE_ENV,
      'NODE_ENV',
      NODE_ENV_VALUES,
      'development',
      errors,
    ),
    NEXT_PUBLIC_APP_ENV: parseEnum(
      rawEnv.NEXT_PUBLIC_APP_ENV,
      'NEXT_PUBLIC_APP_ENV',
      APP_ENV_VALUES,
      'development',
      errors,
    ),
    NEXT_PUBLIC_API_MODE: nextPublicApiMode,
    NEXT_PUBLIC_DIRECT_API_BASE_URL: nextPublicDirectApiBaseUrl,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: parseOptionalString(rawEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
    NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME: parseOptionalTelegramBotPublicName(
      rawEnv.NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME,
      errors,
    ),
    BACKEND_API_BASE_URL: parseAbsoluteUrl(rawEnv.BACKEND_API_BASE_URL, 'BACKEND_API_BASE_URL', errors),
  }

  if (errors.length > 0) {
    throw new Error(`Invalid frontend environment variables:\n${errors.map(error => `- ${error}`).join('\n')}`)
  }

  return Object.freeze(frontendEnv)
}

function parseAbsoluteUrl(rawValue, variableName, errors) {
  const fallback = 'http://localhost:3000/api/v1'
  const value = (rawValue ?? fallback).trim()

  try {
    const parsedUrl = new URL(value)
    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    errors.push(`${variableName} must be an absolute URL, got "${rawValue}"`)
    return fallback
  }
}

function parseOptionalAbsoluteUrl(rawValue, variableName, errors) {
  const value = rawValue?.trim()

  if (!value) {
    return undefined
  }

  try {
    const parsedUrl = new URL(value)
    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    errors.push(`${variableName} must be an absolute URL, got "${rawValue}"`)
    return undefined
  }
}

function parseEnum(rawValue, variableName, allowed, fallback, errors) {
  const value = (rawValue ?? fallback).trim()

  if (allowed.includes(value)) {
    return value
  }

  errors.push(`${variableName} must be one of [${allowed.join(', ')}], got "${rawValue}"`)
  return fallback
}

function parseOptionalString(rawValue) {
  const value = rawValue?.trim()
  return value ? value : undefined
}

function parseOptionalTelegramBotPublicName(rawValue, errors) {
  const value = parseOptionalString(rawValue)
  if (!value) {
    return undefined
  }

  const normalizedValue = value.replace(/^@/, '')
  const isValidHandle = /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(normalizedValue)

  if (!isValidHandle) {
    errors.push(
      `NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME must be a Telegram bot handle (from t.me/<handle>) without "@", got "${rawValue}"`,
    )
    return undefined
  }

  return normalizedValue
}
