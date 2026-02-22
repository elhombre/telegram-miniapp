'use client'

import { useEffect, useState } from 'react'
import { readTelegramRuntimeContext } from './telegram-context'
import { applyTelegramTheme, getTelegramWebApp } from './telegram'

interface UseTelegramMiniAppOptions {
  waitForSignedData?: boolean
  maxAttempts?: number
  intervalMs?: number
}

interface UseTelegramMiniAppResult {
  isInTelegram: boolean | null
  initDataRaw: string
}

const DEFAULT_MAX_ATTEMPTS = 20
const DEFAULT_INTERVAL_MS = 150

export function useTelegramMiniApp(options: UseTelegramMiniAppOptions = {}): UseTelegramMiniAppResult {
  const waitForSignedData = options.waitForSignedData ?? false
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS

  // Keep first render deterministic for SSR/CSR hydration.
  // Runtime mode is resolved after mount in the effect below.
  const [isInTelegram, setIsInTelegram] = useState<boolean | null>(null)
  const [initDataRaw, setInitDataRaw] = useState('')

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    let timerId: ReturnType<typeof setTimeout> | undefined

    const sync = () => {
      if (cancelled) {
        return
      }

      const context = readTelegramRuntimeContext()
      const inMiniAppMode = context.hasMiniAppLaunchParam

      setIsInTelegram(inMiniAppMode)

      if (context.hasSignedAuthData) {
        setInitDataRaw(context.initDataRaw)

        const webApp = getTelegramWebApp()
        if (webApp) {
          webApp.ready()
          webApp.expand()
          applyTelegramTheme(webApp.themeParams)
        }
        return
      }

      setInitDataRaw('')

      if (!waitForSignedData || !inMiniAppMode) {
        return
      }

      if (attempts >= maxAttempts) {
        return
      }

      attempts += 1
      timerId = setTimeout(sync, intervalMs)
    }

    sync()

    return () => {
      cancelled = true
      if (timerId) {
        clearTimeout(timerId)
      }
    }
  }, [intervalMs, maxAttempts, waitForSignedData])

  return {
    isInTelegram,
    initDataRaw,
  }
}
