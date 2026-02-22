import { getTelegramWebApp } from './telegram'

export interface TelegramRuntimeContext {
  hasSignedAuthData: boolean
  hasMiniAppLaunchParam: boolean
  initDataRaw: string
}

let miniAppModeDetectedInRuntime = false

export function readTelegramRuntimeContext(): TelegramRuntimeContext {
  const { hasMiniAppLaunchParam, hintedInitDataRaw } = readTelegramUrlHints()
  const initDataRaw = hintedInitDataRaw.trim()
  const hasSignedPayload = hasSignedPayloadInInitData(initDataRaw)

  return {
    hasSignedAuthData: hasSignedPayload,
    hasMiniAppLaunchParam,
    initDataRaw,
  }
}

function readTelegramUrlHints(): { hasMiniAppLaunchParam: boolean; hintedInitDataRaw: string } {
  if (typeof window === 'undefined') {
    return {
      hasMiniAppLaunchParam: false,
      hintedInitDataRaw: '',
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const hash = window.location.hash.replace(/^#/, '')
  const hashParams = hash ? new URLSearchParams(hash) : new URLSearchParams()
  const hasMiniAppLaunchParamInUrl =
    searchParams.get('miniapp') === '1' || hashParams.get('miniapp') === '1'

  if (hasMiniAppLaunchParamInUrl) {
    // Detection contract: miniapp mode is entered only by explicit launch marker miniapp=1.
    // Keep this state for current SPA runtime so route transitions without query keep miniapp UX.
    miniAppModeDetectedInRuntime = true
  }

  const hasMiniAppLaunchParam = hasMiniAppLaunchParamInUrl || miniAppModeDetectedInRuntime

  // Telegram can place signed auth payload either in query or in hash.
  // We intentionally prefer URL hints first, then fallback to WebApp runtime value.
  const hintedInitDataRaw =
    (searchParams.get('tgWebAppData') ?? '').trim() ||
    (hashParams.get('tgWebAppData') ?? '').trim() ||
    readTelegramWebAppInitDataRaw()

  return {
    hasMiniAppLaunchParam,
    hintedInitDataRaw,
  }
}

function readTelegramWebAppInitDataRaw(): string {
  const webApp = getTelegramWebApp()
  const initDataRaw = webApp?.initData?.trim() ?? ''

  if (!initDataRaw) {
    return ''
  }

  return initDataRaw
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
