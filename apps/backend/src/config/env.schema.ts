export type NodeEnv = 'development' | 'test' | 'production'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppEnv {
  NODE_ENV: NodeEnv
  PORT: number
  API_PREFIX: string
  FRONTEND_ORIGIN?: string
  LOG_LEVEL: LogLevel
  DATABASE_URL: string
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
  ACCESS_TOKEN_TTL_SECONDS: number
  REFRESH_TOKEN_TTL_DAYS: number
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: number
  GOOGLE_CLIENT_ID?: string
  ACCOUNT_LINK_TOKEN_TTL_MINUTES: number
}

let cachedEnv: AppEnv | undefined

export function getEnv(rawEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  if (rawEnv === process.env && cachedEnv) {
    return cachedEnv
  }

  const errors: string[] = []

  const env: AppEnv = {
    NODE_ENV: parseEnum(rawEnv.NODE_ENV, 'NODE_ENV', ['development', 'test', 'production'], 'development', errors),
    PORT: parsePort(rawEnv.PORT, errors),
    API_PREFIX: parseApiPrefix(rawEnv.API_PREFIX, errors),
    FRONTEND_ORIGIN: parseOptionalUrl(rawEnv.FRONTEND_ORIGIN, 'FRONTEND_ORIGIN', errors),
    LOG_LEVEL: parseEnum(rawEnv.LOG_LEVEL, 'LOG_LEVEL', ['debug', 'info', 'warn', 'error'], 'info', errors),
    DATABASE_URL: parseRequiredString(rawEnv.DATABASE_URL, 'DATABASE_URL', errors),
    JWT_ACCESS_SECRET: parseRequiredString(rawEnv.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', errors),
    JWT_REFRESH_SECRET: parseRequiredString(rawEnv.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', errors),
    ACCESS_TOKEN_TTL_SECONDS: parsePositiveInt(
      rawEnv.ACCESS_TOKEN_TTL_SECONDS,
      'ACCESS_TOKEN_TTL_SECONDS',
      900,
      errors,
    ),
    REFRESH_TOKEN_TTL_DAYS: parsePositiveInt(rawEnv.REFRESH_TOKEN_TTL_DAYS, 'REFRESH_TOKEN_TTL_DAYS', 30, errors),
    TELEGRAM_BOT_TOKEN: parseOptionalString(rawEnv.TELEGRAM_BOT_TOKEN),
    TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: parsePositiveInt(
      rawEnv.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
      'TELEGRAM_INIT_DATA_MAX_AGE_SECONDS',
      86400,
      errors,
    ),
    GOOGLE_CLIENT_ID: parseOptionalString(rawEnv.GOOGLE_CLIENT_ID),
    ACCOUNT_LINK_TOKEN_TTL_MINUTES: parsePositiveInt(
      rawEnv.ACCOUNT_LINK_TOKEN_TTL_MINUTES,
      'ACCOUNT_LINK_TOKEN_TTL_MINUTES',
      10,
      errors,
    ),
  }

  if (errors.length > 0) {
    throw new Error(`Invalid backend environment variables:\n${errors.map(error => `- ${error}`).join('\n')}`)
  }

  if (rawEnv === process.env) {
    cachedEnv = Object.freeze(env)
  }

  return env
}

function parsePort(rawValue: string | undefined, errors: string[]): number {
  const defaultPort = 3000

  if (!rawValue) {
    return defaultPort
  }

  const numericValue = Number.parseInt(rawValue, 10)
  if (!Number.isInteger(numericValue) || numericValue <= 0 || numericValue > 65535) {
    errors.push(`PORT must be an integer between 1 and 65535, got "${rawValue}"`)
    return defaultPort
  }

  return numericValue
}

function parseApiPrefix(rawValue: string | undefined, errors: string[]): string {
  const normalized = (rawValue ?? 'api/v1').trim().replace(/^\/+|\/+$/g, '')

  if (!normalized) {
    errors.push('API_PREFIX cannot be empty')
    return 'api/v1'
  }

  return normalized
}

function parseOptionalUrl(
  rawValue: string | undefined,
  variableName: string,
  errors: string[],
): string | undefined {
  if (!rawValue || !rawValue.trim()) {
    return undefined
  }

  try {
    const parsedUrl = new URL(rawValue)
    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    errors.push(`${variableName} must be a valid URL, got "${rawValue}"`)
    return undefined
  }
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

function parseOptionalString(rawValue: string | undefined): string | undefined {
  const value = rawValue?.trim()
  return value ? value : undefined
}

function parsePositiveInt(
  rawValue: string | undefined,
  variableName: string,
  fallback: number,
  errors: string[],
): number {
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
