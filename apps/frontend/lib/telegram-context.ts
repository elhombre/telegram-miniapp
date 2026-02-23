import { applyTelegramTheme, getTelegramWebApp, type TelegramWebApp } from './telegram'

export interface TelegramRuntimeContext {
  isInTelegram: boolean
  hasSignedAuthData: boolean
  hasTelegramUrlHints: boolean
  initDataRaw: string
  webApp?: TelegramWebApp
}

export function readTelegramRuntimeContext(): TelegramRuntimeContext {
  const { hasTelegramUrlHints, hintedInitDataRaw } = readTelegramUrlHints()
  const webApp = getTelegramWebApp()
  const initDataRaw = ((webApp?.initData ?? '').trim() || hintedInitDataRaw).trim()
  const hasSignedPayload = hasSignedPayloadInInitData(initDataRaw)
  const isInTelegram = hasSignedPayload || (hasTelegramUrlHints && Boolean(webApp))

  if (webApp && hasSignedPayload) {
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

function readTelegramUrlHints(): { hasTelegramUrlHints: boolean; hintedInitDataRaw: string } {
  if (typeof window === 'undefined') {
    return {
      hasTelegramUrlHints: false,
      hintedInitDataRaw: '',
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.has('tgWebAppPlatform') || searchParams.has('tgWebAppData')) {
    return {
      hasTelegramUrlHints: true,
      hintedInitDataRaw: (searchParams.get('tgWebAppData') ?? '').trim(),
    }
  }

  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) {
    return {
      hasTelegramUrlHints: false,
      hintedInitDataRaw: '',
    }
  }

  const hashParams = new URLSearchParams(hash)
  const hasTelegramUrlHints = hashParams.has('tgWebAppPlatform') || hashParams.has('tgWebAppData')
  const hintedInitDataRaw = (hashParams.get('tgWebAppData') ?? '').trim()
  return {
    hasTelegramUrlHints,
    hintedInitDataRaw,
  }
}

function hasSignedPayloadInInitData(initDataRaw: string): boolean {
  if (!initDataRaw) {
    return false
  }

  const initParams = new URLSearchParams(initDataRaw)
  const hasUserId = Boolean(initParams.get('user'))
  const hasQueryId = Boolean(initParams.get('query_id'))
  const hasHash = Boolean(initParams.get('hash'))
  return hasHash && (hasUserId || hasQueryId)
}
