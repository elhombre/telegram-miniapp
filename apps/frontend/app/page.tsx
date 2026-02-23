'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './page.module.css'
import { getTelegramVerifyInitDataEndpoint } from '../lib/api'
import { applyTelegramTheme, getTelegramWebApp, type TelegramWebAppUser } from '../lib/telegram'

interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    role: string
    email: string | null
  }
}

interface ApiErrorResponse {
  code?: string
  message?: string
}

type AuthStatus = 'idle' | 'loading' | 'success' | 'error'

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null)
  const [isInTelegram, setIsInTelegram] = useState(false)
  const [initDataRaw, setInitDataRaw] = useState<string>('')
  const [telegramUser, setTelegramUser] = useState<TelegramWebAppUser | null>(null)

  const authenticate = useCallback(async (rawInitData: string) => {
    setAuthStatus('loading')
    setAuthError(null)

    try {
      const response = await fetch(getTelegramVerifyInitDataEndpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          initDataRaw: rawInitData,
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json()) as ApiErrorResponse
        throw new Error(errorPayload.message || errorPayload.code || `HTTP ${response.status}`)
      }

      const payload = (await response.json()) as AuthResponse
      setAuthResponse(payload)
      persistAuthSession(payload)
      setAuthStatus('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAuthStatus('error')
      setAuthError(message)
    }
  }, [])

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 40
    const retryIntervalMs = 125

    const initializeTelegramContext = () => {
      const telegramWebApp = getTelegramWebApp()
      if (!telegramWebApp) {
        return false
      }

      setIsInTelegram(true)
      telegramWebApp.ready()
      telegramWebApp.expand()
      applyTelegramTheme(telegramWebApp.themeParams)

      setInitDataRaw(telegramWebApp.initData ?? '')
      setTelegramUser(telegramWebApp.initDataUnsafe.user ?? null)

      return true
    }

    if (initializeTelegramContext()) {
      return
    }

    const intervalId = window.setInterval(() => {
      attempts += 1

      const initialized = initializeTelegramContext()
      if (initialized || attempts >= maxAttempts) {
        window.clearInterval(intervalId)
        if (!initialized) {
          setIsInTelegram(false)
        }
      }
    }, retryIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!initDataRaw) {
      return
    }

    void authenticate(initDataRaw)
  }, [authenticate, initDataRaw])

  const userName = useMemo(() => formatUserName(telegramUser), [telegramUser])

  return (
    <div className={styles.page}>
      <main className={styles.panel}>
        <header className={styles.header}>
          <p className={styles.kicker}>Telegram Mini App</p>
          <h1 className={styles.title}>Auth Smoke Test</h1>
          <p className={styles.subtitle}>
            Verifies Mini App identity by sending <code>initDataRaw</code> to backend.
          </p>
        </header>

        <section className={styles.grid}>
          <article className={styles.card}>
            <h2>Telegram Context</h2>
            <p>Status: {isInTelegram ? 'inside Telegram' : 'regular browser'}</p>
            <p>User: {userName}</p>
            <p>Payload size: {initDataRaw.length} chars</p>
          </article>

          <article className={styles.card}>
            <h2>Backend Auth</h2>
            <p>Status: {authStatus}</p>
            {authStatus === 'error' && authError ? <p className={styles.error}>Error: {authError}</p> : null}
            {authResponse ? (
              <div className={styles.authData}>
                <p>User ID: {authResponse.user.id}</p>
                <p>Role: {authResponse.user.role}</p>
                <p>Email: {authResponse.user.email ?? '—'}</p>
                <p>Access TTL: {authResponse.expiresIn}s</p>
              </div>
            ) : null}
          </article>
        </section>

        <section className={styles.manualSection}>
          <h2>Manual Re-Run</h2>
          <textarea
            className={styles.textarea}
            value={initDataRaw}
            onChange={event => setInitDataRaw(event.target.value)}
            placeholder="Paste initDataRaw from Telegram if needed"
            rows={5}
          />
          <div className={styles.actions}>
            <button
              className={styles.primary}
              type="button"
              onClick={() => {
                if (!initDataRaw.trim()) {
                  setAuthStatus('error')
                  setAuthError('initDataRaw is empty')
                  return
                }
                void authenticate(initDataRaw.trim())
              }}
              disabled={authStatus === 'loading'}
            >
              {authStatus === 'loading' ? 'Authorizing...' : 'Authorize Again'}
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                setAuthResponse(null)
                setAuthError(null)
                setAuthStatus('idle')
                sessionStorage.removeItem('miniapp.accessToken')
                sessionStorage.removeItem('miniapp.refreshToken')
              }}
            >
              Clear Local Session
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

function persistAuthSession(payload: AuthResponse) {
  if (typeof window === 'undefined') {
    return
  }

  sessionStorage.setItem('miniapp.accessToken', payload.accessToken)
  sessionStorage.setItem('miniapp.refreshToken', payload.refreshToken)
}

function formatUserName(user: TelegramWebAppUser | null): string {
  if (!user) {
    return 'unknown'
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  if (name) {
    return name
  }

  if (user.username) {
    return `@${user.username}`
  }

  return `id:${user.id}`
}
