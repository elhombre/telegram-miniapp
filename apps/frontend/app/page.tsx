'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './page.module.css'
import {
  getCurrentApiMode,
  getLogoutEndpoint,
  getRefreshSessionEndpoint,
  getTelegramVerifyInitDataEndpoint,
} from '../lib/api'
import {
  clearAuthSession,
  type AuthResponse,
  maskToken,
  parseApiError,
  persistAuthSession,
  readStoredRefreshToken,
  readStoredSession,
} from '../lib/auth-client'
import { applyTelegramTheme, getTelegramWebApp, type TelegramWebAppUser } from '../lib/telegram'

type AuthStatus = 'idle' | 'loading' | 'success' | 'error'
type SessionActionStatus = 'idle' | 'loading' | 'success' | 'error'
const API_MODE = getCurrentApiMode()

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null)
  const [sessionActionStatus, setSessionActionStatus] = useState<SessionActionStatus>('idle')
  const [sessionActionMessage, setSessionActionMessage] = useState<string | null>(null)
  const [sessionActionError, setSessionActionError] = useState<string | null>(null)
  const [isInTelegram, setIsInTelegram] = useState(false)
  const [initDataRaw, setInitDataRaw] = useState<string>('')
  const [telegramUser, setTelegramUser] = useState<TelegramWebAppUser | null>(null)

  useEffect(() => {
    const storedSession = readStoredSession()
    if (storedSession) {
      setAuthResponse(storedSession)
    }
  }, [])

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
        throw new Error(await parseApiError(response))
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

  const refreshSession = useCallback(async () => {
    const refreshToken = authResponse?.refreshToken ?? readStoredRefreshToken()

    if (!refreshToken) {
      setSessionActionStatus('error')
      setSessionActionError('Refresh token is not available')
      setSessionActionMessage(null)
      return
    }

    setSessionActionStatus('loading')
    setSessionActionError(null)
    setSessionActionMessage(null)

    try {
      const response = await fetch(getRefreshSessionEndpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as AuthResponse
      setAuthResponse(payload)
      persistAuthSession(payload)
      setSessionActionStatus('success')
      setSessionActionMessage('Session refreshed')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSessionActionStatus('error')
      setSessionActionError(message)
    }
  }, [authResponse])

  const logout = useCallback(async () => {
    const refreshToken = authResponse?.refreshToken ?? readStoredRefreshToken()

    setSessionActionStatus('loading')
    setSessionActionError(null)
    setSessionActionMessage(null)

    if (!refreshToken) {
      clearAuthSession()
      setAuthResponse(null)
      setAuthStatus('idle')
      setAuthError(null)
      setSessionActionStatus('success')
      setSessionActionMessage('Local session cleared')
      return
    }

    try {
      const response = await fetch(getLogoutEndpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      clearAuthSession()
      setAuthResponse(null)
      setAuthStatus('idle')
      setAuthError(null)
      setSessionActionStatus('success')
      setSessionActionMessage('Logged out')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSessionActionStatus('error')
      setSessionActionError(message)
    }
  }, [authResponse])

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
  const backendAuthStatusLabel = authStatus === 'idle' && authResponse ? 'cached' : authStatus

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
            <p>API mode: {API_MODE}</p>
            <p>User: {userName}</p>
            <p>Payload size: {initDataRaw.length} chars</p>
          </article>

          <article className={styles.card}>
            <h2>Backend Auth</h2>
            <p>Status: {backendAuthStatusLabel}</p>
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

          <article className={styles.card}>
            <h2>Session</h2>
            <p>Status: {authResponse ? 'active' : 'empty'}</p>
            {authResponse ? (
              <div className={styles.authData}>
                <p>Access: {maskToken(authResponse.accessToken)}</p>
                <p>Refresh: {maskToken(authResponse.refreshToken)}</p>
              </div>
            ) : null}
            {sessionActionStatus === 'success' && sessionActionMessage ? (
              <p className={styles.success}>{sessionActionMessage}</p>
            ) : null}
            {sessionActionStatus === 'error' && sessionActionError ? (
              <p className={styles.error}>Error: {sessionActionError}</p>
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
                clearAuthSession()
                setSessionActionStatus('idle')
                setSessionActionMessage(null)
                setSessionActionError(null)
              }}
            >
              Clear Local Session
            </button>
          </div>
        </section>

        <section className={styles.manualSection}>
          <h2>Session Actions</h2>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              type="button"
              onClick={() => {
                void refreshSession()
              }}
              disabled={sessionActionStatus === 'loading'}
            >
              {sessionActionStatus === 'loading' ? 'Processing...' : 'Refresh Session'}
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                void logout()
              }}
              disabled={sessionActionStatus === 'loading'}
            >
              Logout
            </button>
          </div>
        </section>

        <nav className={styles.navLinks}>
          <Link href="/auth/register">Web: Register</Link>
          <Link href="/auth/login">Web: Login</Link>
        </nav>
      </main>
    </div>
  )
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
