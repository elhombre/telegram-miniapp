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
const QUICK_BOOTSTRAP_ATTEMPTS = 2

let cachedIsInTelegram: boolean | null = null
let cachedInitDataRaw = ''

export function useTelegramMiniApp(options: UseTelegramMiniAppOptions = {}): UseTelegramMiniAppResult {
  const waitForSignedData = options.waitForSignedData ?? false
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS

  const [isInTelegram, setIsInTelegram] = useState<boolean | null>(cachedIsInTelegram)
  const [initDataRaw, setInitDataRaw] = useState(cachedInitDataRaw)

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
        cachedIsInTelegram = false
        cachedInitDataRaw = ''
        setIsInTelegram(false)
        setInitDataRaw('')
        return
      }

      if (context.hasSignedAuthData) {
        cachedIsInTelegram = true
        cachedInitDataRaw = context.initDataRaw
        setIsInTelegram(true)
        setInitDataRaw(context.initDataRaw)
        return
      }

      if (attempts >= attemptsLimit) {
        cachedIsInTelegram = false
        cachedInitDataRaw = ''
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
