const TELEGRAM_VERIFY_INIT_DATA_PATH = '/auth/telegram/verify-init-data'
const FRONTEND_PROXY_TELEGRAM_VERIFY_INIT_DATA_PATH = '/api/auth/telegram/verify-init-data'

export function getTelegramVerifyInitDataEndpoint(): string {
  const apiMode = getApiMode()

  if (apiMode === 'direct') {
    const directApiBaseUrl = normalizeDirectApiBaseUrl(process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL)
    if (!directApiBaseUrl) {
      throw new Error('NEXT_PUBLIC_DIRECT_API_BASE_URL is required when NEXT_PUBLIC_API_MODE=direct')
    }

    return `${directApiBaseUrl}${TELEGRAM_VERIFY_INIT_DATA_PATH}`
  }

  return FRONTEND_PROXY_TELEGRAM_VERIFY_INIT_DATA_PATH
}

function getApiMode(): 'proxy' | 'direct' {
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
