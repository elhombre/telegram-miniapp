import { applyTelegramTheme, getTelegramWebApp, type TelegramWebApp } from './telegram'

export interface TelegramRuntimeContext {
  isInTelegram: boolean
  hasSignedAuthData: boolean
  hasTelegramUrlHints: boolean
  initDataRaw: string
  webApp?: TelegramWebApp
}

export function readTelegramRuntimeContext(): TelegramRuntimeContext {
  const hasTelegramUrlHints = detectTelegramUrlHints()
  const webApp = getTelegramWebApp()
  if (!webApp) {
    return {
      isInTelegram: false,
      hasSignedAuthData: false,
      hasTelegramUrlHints,
      initDataRaw: '',
    }
  }

  const initDataRaw = (webApp.initData ?? '').trim()
  const hasUserId = Boolean(webApp.initDataUnsafe.user?.id)
  const hasQueryId = Boolean(webApp.initDataUnsafe.query_id)
  const hasHash = Boolean(webApp.initDataUnsafe.hash)
  const hasSignedPayload = initDataRaw.length > 0 && (hasUserId || hasQueryId || hasHash)
  const isInTelegram = hasSignedPayload

  if (hasSignedPayload) {
    webApp.ready()
    webApp.expand()
    applyTelegramTheme(webApp.themeParams)
  }

  return {
    isInTelegram,
    hasSignedAuthData: hasSignedPayload,
    hasTelegramUrlHints,
    initDataRaw,
    webApp,
  }
}

function detectTelegramUrlHints(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.has('tgWebAppPlatform') || searchParams.has('tgWebAppData')) {
    return true
  }

  const hash = window.location.hash
  return hash.includes('tgWebAppPlatform') || hash.includes('tgWebAppData')
}
