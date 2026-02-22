type ApiMode = 'proxy' | 'direct'

const TELEGRAM_VERIFY_INIT_DATA_PATH = 'telegram/verify-init-data'
const EMAIL_REGISTER_PATH = 'email/register'
const EMAIL_LOGIN_PATH = 'email/login'
const GOOGLE_CALLBACK_PATH = 'google/callback'
const REFRESH_SESSION_PATH = 'refresh'
const LOGOUT_PATH = 'logout'
const LINK_START_PATH = 'link/start'
const LINK_TELEGRAM_START_PATH = 'link/telegram/start'
const LINK_TELEGRAM_STATUS_PATH = 'link/telegram/status'
const LINK_TELEGRAM_UNLINK_PATH = 'link/telegram/unlink'
const LINK_PROVIDERS_PATH = 'link/providers'
const LINK_CONFIRM_PATH = 'link/confirm'
const LINK_EMAIL_REQUEST_PATH = 'link/email/request'
const LINK_EMAIL_CONFIRM_PATH = 'link/email/confirm'
const NOTES_PATH = 'notes'

export function getTelegramVerifyInitDataEndpoint(): string {
  return getAuthEndpoint(TELEGRAM_VERIFY_INIT_DATA_PATH)
}

export function getEmailRegisterEndpoint(): string {
  return getAuthEndpoint(EMAIL_REGISTER_PATH)
}

export function getEmailLoginEndpoint(): string {
  return getAuthEndpoint(EMAIL_LOGIN_PATH)
}

export function getGoogleCallbackEndpoint(): string {
  return getAuthEndpoint(GOOGLE_CALLBACK_PATH)
}

export function getRefreshSessionEndpoint(): string {
  return getAuthEndpoint(REFRESH_SESSION_PATH)
}

export function getLogoutEndpoint(): string {
  return getAuthEndpoint(LOGOUT_PATH)
}

export function getLinkStartEndpoint(): string {
  return getAuthEndpoint(LINK_START_PATH)
}

export function getLinkTelegramStartEndpoint(): string {
  return getAuthEndpoint(LINK_TELEGRAM_START_PATH)
}

export function getLinkTelegramStatusEndpoint(): string {
  return getAuthEndpoint(LINK_TELEGRAM_STATUS_PATH)
}

export function getLinkTelegramUnlinkEndpoint(): string {
  return getAuthEndpoint(LINK_TELEGRAM_UNLINK_PATH)
}

export function getLinkProvidersEndpoint(): string {
  return getAuthEndpoint(LINK_PROVIDERS_PATH)
}

export function getLinkConfirmEndpoint(): string {
  return getAuthEndpoint(LINK_CONFIRM_PATH)
}

export function getLinkEmailRequestEndpoint(): string {
  return getAuthEndpoint(LINK_EMAIL_REQUEST_PATH)
}

export function getLinkEmailConfirmEndpoint(): string {
  return getAuthEndpoint(LINK_EMAIL_CONFIRM_PATH)
}

export function getNotesEndpoint(): string {
  return getApiEndpoint(NOTES_PATH)
}

export function getDeleteNoteEndpoint(noteId: string): string {
  const normalizedNoteId = noteId.trim()
  if (!normalizedNoteId) {
    throw new Error('Note id is required')
  }

  return `${getNotesEndpoint()}/${encodeURIComponent(normalizedNoteId)}`
}

export function getCurrentApiMode(): ApiMode {
  return getApiMode()
}

function getAuthEndpoint(authPath: string): string {
  return getApiEndpoint(`auth/${authPath}`)
}

function getApiEndpoint(apiPath: string): string {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(apiPath)) {
    throw new Error(`Unsupported API path: ${apiPath}`)
  }

  const apiMode = getApiMode()
  if (apiMode === 'direct') {
    const directApiBaseUrl = normalizeDirectApiBaseUrl(process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL)
    if (!directApiBaseUrl) {
      throw new Error('NEXT_PUBLIC_DIRECT_API_BASE_URL is required when NEXT_PUBLIC_API_MODE=direct')
    }
    return `${directApiBaseUrl}/${apiPath}`
  }

  return `/api/${apiPath}`
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
