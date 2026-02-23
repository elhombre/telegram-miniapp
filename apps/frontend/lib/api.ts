type ApiMode = 'proxy' | 'direct'

const TELEGRAM_VERIFY_INIT_DATA_PATH = 'telegram/verify-init-data'
const REFRESH_SESSION_PATH = 'refresh'
const LOGOUT_PATH = 'logout'

export function getTelegramVerifyInitDataEndpoint(): string {
  return getAuthEndpoint(TELEGRAM_VERIFY_INIT_DATA_PATH)
}

export function getRefreshSessionEndpoint(): string {
  return getAuthEndpoint(REFRESH_SESSION_PATH)
}

export function getLogoutEndpoint(): string {
  return getAuthEndpoint(LOGOUT_PATH)
}

export function getCurrentApiMode(): ApiMode {
  return getApiMode()
}

function getAuthEndpoint(authPath: string): string {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(authPath)) {
    throw new Error(`Unsupported auth path: ${authPath}`)
  }

  const apiMode = getApiMode()
  if (apiMode === 'direct') {
    const directApiBaseUrl = normalizeDirectApiBaseUrl(process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL)
    if (!directApiBaseUrl) {
      throw new Error('NEXT_PUBLIC_DIRECT_API_BASE_URL is required when NEXT_PUBLIC_API_MODE=direct')
    }
    return `${directApiBaseUrl}/auth/${authPath}`
  }

  return `/api/auth/${authPath}`
}

function getApiMode(): ApiMode {
  const value = (process.env.NEXT_PUBLIC_API_MODE ?? 'proxy').trim()
  return value === 'direct' ? 'direct' : 'proxy'
}

function normalizeDirectApiBaseUrl(rawValue: string | undefined): string | null {
  const value = rawValue?.trim()
  if (!value) {
    return null
  }

  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch {
    throw new Error('NEXT_PUBLIC_DIRECT_API_BASE_URL must be an absolute URL')
  }
}
