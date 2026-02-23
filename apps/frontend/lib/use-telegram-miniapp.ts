'use client'

import { useEffect, useState } from 'react'
import { readTelegramRuntimeContext } from './telegram-context'

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
const QUICK_BOOTSTRAP_ATTEMPTS = 6

export function useTelegramMiniApp(options: UseTelegramMiniAppOptions = {}): UseTelegramMiniAppResult {
  const waitForSignedData = options.waitForSignedData ?? false
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS

  const [isInTelegram, setIsInTelegram] = useState<boolean | null>(null)
  const [initDataRaw, setInitDataRaw] = useState('')

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    let timerId: ReturnType<typeof setTimeout> | undefined
    const attemptsLimit = waitForSignedData ? maxAttempts : QUICK_BOOTSTRAP_ATTEMPTS

    const sync = () => {
      if (cancelled) {
        return
      }

      const context = readTelegramRuntimeContext()
      if (!context.webApp && !context.hasTelegramUrlHints) {
        setIsInTelegram(false)
        setInitDataRaw('')
        return
      }

      if (context.hasSignedAuthData) {
        setIsInTelegram(true)
        setInitDataRaw(context.initDataRaw)
        return
      }

      if (attempts >= attemptsLimit) {
        setIsInTelegram(false)
        setInitDataRaw('')
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
