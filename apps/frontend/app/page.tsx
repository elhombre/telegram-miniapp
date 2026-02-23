'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './page.module.css'
import {
  getCurrentApiMode,
  getLinkEmailConfirmEndpoint,
  getLinkEmailRequestEndpoint,
  getLinkConfirmEndpoint,
  getLinkStartEndpoint,
  getLogoutEndpoint,
  getRefreshSessionEndpoint,
  getTelegramVerifyInitDataEndpoint,
} from '../lib/api'
import {
  type AuthProvider,
  clearAuthSession,
  type AuthResponse,
  maskToken,
  parseApiError,
  persistAuthProvider,
  persistAuthSession,
  readStoredAccessToken,
  readStoredAuthProvider,
  readStoredRefreshToken,
  readStoredSession,
} from '../lib/auth-client'
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, renderGoogleSignInButton } from '../lib/google-identity'
import {
  buildTelegramLoginWidgetAuthDataRaw,
  renderTelegramLoginWidget,
  TELEGRAM_BOT_PUBLIC_NAME,
} from '../lib/telegram-login-widget'
import { applyTelegramTheme, getTelegramWebApp, type TelegramWebAppUser } from '../lib/telegram'

type AuthStatus = 'idle' | 'loading' | 'success' | 'error'
type SessionActionStatus = 'idle' | 'loading' | 'success' | 'error'
type LinkActionStatus = 'idle' | 'loading' | 'success' | 'error'
type LinkProvider = 'email' | 'google' | 'telegram'

interface LinkStartResponse {
  linkToken: string
  expiresAt: string
}

interface LinkEmailRequestResponse {
  sent: boolean
  provider: 'email'
  email: string
  expiresAt: string
}

interface LinkConfirmResponse {
  linked: boolean
  provider: LinkProvider
}
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
  const [currentAuthProvider, setCurrentAuthProvider] = useState<AuthProvider | null>(null)
  const [linkProvider, setLinkProvider] = useState<LinkProvider>('email')
  const [linkToken, setLinkToken] = useState('')
  const [linkTokenExpiresAt, setLinkTokenExpiresAt] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkEmailCode, setLinkEmailCode] = useState('')
  const [linkStatus, setLinkStatus] = useState<LinkActionStatus>('idle')
  const [googleLinkButtonReady, setGoogleLinkButtonReady] = useState(false)
  const [telegramLinkButtonReady, setTelegramLinkButtonReady] = useState(false)
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const googleLinkButtonRef = useRef<HTMLDivElement | null>(null)
  const telegramLinkButtonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const storedSession = readStoredSession()
    const storedAuthProvider = readStoredAuthProvider()

    if (storedSession) {
      setAuthResponse(storedSession)
    }
    if (storedAuthProvider) {
      setCurrentAuthProvider(storedAuthProvider)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('link_provider') !== 'email') {
      return
    }

    const prefilledEmail = params.get('link_email')?.trim() ?? ''
    const prefilledCode = params.get('link_code')?.trim() ?? ''
    const prefilledLinkToken = params.get('link_token')?.trim() ?? ''

    if (prefilledEmail) {
      setLinkEmail(prefilledEmail)
    }

    if (prefilledCode) {
      setLinkEmailCode(prefilledCode)
    }

    if (prefilledLinkToken) {
      setLinkToken(prefilledLinkToken)
      setLinkTokenExpiresAt(null)
    }

    setLinkProvider('email')

    if (prefilledEmail || prefilledCode) {
      setLinkMessage('Email verification fields were prefilled from the link.')
    }

    window.history.replaceState(null, '', window.location.pathname)
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
      persistAuthProvider('telegram')
      setCurrentAuthProvider('telegram')
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
      setCurrentAuthProvider(null)
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

  const ensureLinkToken = useCallback(async (accessToken: string): Promise<string | null> => {
    const expiresAtTs = linkTokenExpiresAt ? Date.parse(linkTokenExpiresAt) : Number.NaN
    const hasUsableToken = Boolean(linkToken.trim()) && Number.isFinite(expiresAtTs) && expiresAtTs - Date.now() > 15_000
    if (hasUsableToken) {
      return linkToken.trim()
    }

    try {
      const response = await fetch(getLinkStartEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: '{}',
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as LinkStartResponse
      setLinkToken(payload.linkToken)
      setLinkTokenExpiresAt(payload.expiresAt)
      return payload.linkToken
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLinkError(message)
      setLinkMessage(null)
      return null
    }
  }, [linkToken, linkTokenExpiresAt])

  const requestEmailLinkCode = useCallback(async () => {
    const accessToken = authResponse?.accessToken ?? readStoredAccessToken()
    if (!accessToken) {
      setLinkStatus('error')
      setLinkError('Access token is required for email linking')
      setLinkMessage(null)
      return
    }

    const ensuredLinkToken = await ensureLinkToken(accessToken)
    if (!ensuredLinkToken) {
      setLinkStatus('error')
      setLinkMessage(null)
      return
    }

    const trimmedEmail = linkEmail.trim()
    if (!trimmedEmail) {
      setLinkStatus('error')
      setLinkError('email is required for email linking')
      setLinkMessage(null)
      return
    }

    setLinkStatus('loading')
    setLinkError(null)
    setLinkMessage(null)

    try {
      const response = await fetch(getLinkEmailRequestEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          linkToken: ensuredLinkToken,
          email: trimmedEmail,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as LinkEmailRequestResponse
      setLinkTokenExpiresAt(payload.expiresAt)
      setLinkStatus('success')
      setLinkMessage(`Verification code sent to ${payload.email}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLinkStatus('error')
      setLinkError(message)
      setLinkMessage(null)
    }
  }, [authResponse, ensureLinkToken, linkEmail])

  const confirmLink = useCallback(async (options?: { googleIdToken?: string; telegramAuthDataRaw?: string }) => {
    const accessToken = authResponse?.accessToken ?? readStoredAccessToken()
    if (!accessToken) {
      setLinkStatus('error')
      setLinkError('Access token is required for link confirmation')
      setLinkMessage(null)
      return
    }

    const ensuredLinkToken = await ensureLinkToken(accessToken)
    if (!ensuredLinkToken) {
      setLinkStatus('error')
      setLinkMessage(null)
      return
    }

    const payload: {
      linkToken: string
      provider: Exclude<LinkProvider, 'email'>
      email?: string
      idToken?: string
      initDataRaw?: string
    } = {
      linkToken: ensuredLinkToken,
      provider: linkProvider === 'google' ? 'google' : 'telegram',
    }

    if (linkProvider === 'email') {
      const trimmedEmail = linkEmail.trim()
      if (!trimmedEmail) {
        setLinkStatus('error')
        setLinkError('email is required for email linking')
        setLinkMessage(null)
        return
      }

      const code = linkEmailCode.trim()
      if (!code) {
        setLinkStatus('error')
        setLinkError('verification code is required for email linking')
        setLinkMessage(null)
        return
      }

      setLinkStatus('loading')
      setLinkError(null)
      setLinkMessage(null)

      try {
        const response = await fetch(getLinkEmailConfirmEndpoint(), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            linkToken: ensuredLinkToken,
            email: trimmedEmail,
            code,
          }),
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        const result = (await response.json()) as LinkConfirmResponse
        setLinkStatus('success')
        setLinkMessage(`Linked successfully: ${result.provider}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setLinkStatus('error')
        setLinkError(message)
        setLinkMessage(null)
      }

      return
    }

    if (linkProvider === 'google') {
      const googleIdToken = options?.googleIdToken?.trim()
      if (!googleIdToken) {
        setLinkStatus('error')
        setLinkError('Use Google button to authorize provider linking')
        setLinkMessage(null)
        return
      }

      payload.idToken = googleIdToken
    } else {
      const telegramAuthDataRaw = isInTelegram ? initDataRaw.trim() : options?.telegramAuthDataRaw?.trim()

      if (!telegramAuthDataRaw) {
        setLinkStatus('error')
        setLinkError('Use Telegram button to authorize provider linking')
        setLinkMessage(null)
        return
      }

      payload.initDataRaw = telegramAuthDataRaw
    }

    setLinkStatus('loading')
    setLinkError(null)
    setLinkMessage(null)

    try {
      const response = await fetch(getLinkConfirmEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      setLinkStatus('success')
      setLinkMessage(`Linked successfully: ${linkProvider}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLinkStatus('error')
      setLinkError(message)
      setLinkMessage(null)
    }
  }, [authResponse, ensureLinkToken, initDataRaw, isInTelegram, linkEmail, linkEmailCode, linkProvider])

  useEffect(() => {
    if (linkProvider !== 'google') {
      setGoogleLinkButtonReady(false)
      return
    }

    if (isInTelegram) {
      setGoogleLinkButtonReady(false)
      return
    }

    if (!GOOGLE_CLIENT_ID) {
      setGoogleLinkButtonReady(false)
      return
    }

    let isCancelled = false

    const initializeGoogleLinkButton = async () => {
      try {
        await loadGoogleIdentityScript()
      } catch (error) {
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : String(error)
          setLinkError(message)
          setGoogleLinkButtonReady(false)
        }
        return
      }

      if (isCancelled || !googleLinkButtonRef.current) {
        return
      }

      renderGoogleSignInButton(googleLinkButtonRef.current, credential => {
        void confirmLink({ googleIdToken: credential })
      })
      setGoogleLinkButtonReady(true)
    }

    void initializeGoogleLinkButton()

    return () => {
      isCancelled = true
      if (googleLinkButtonRef.current) {
        googleLinkButtonRef.current.innerHTML = ''
      }
    }
  }, [confirmLink, isInTelegram, linkProvider])

  useEffect(() => {
    if (linkProvider !== 'telegram') {
      setTelegramLinkButtonReady(false)
      return
    }

    if (isInTelegram) {
      setTelegramLinkButtonReady(false)
      return
    }

    if (!TELEGRAM_BOT_PUBLIC_NAME) {
      setTelegramLinkButtonReady(false)
      return
    }

    if (!telegramLinkButtonRef.current) {
      setTelegramLinkButtonReady(false)
      return
    }

    let cleanup: (() => void) | undefined
    try {
      cleanup = renderTelegramLoginWidget(telegramLinkButtonRef.current, user => {
        const authDataRaw = buildTelegramLoginWidgetAuthDataRaw(user)
        void confirmLink({ telegramAuthDataRaw: authDataRaw })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLinkError(message)
      setTelegramLinkButtonReady(false)
      return
    }

    setTelegramLinkButtonReady(true)

    return () => {
      cleanup?.()
      if (telegramLinkButtonRef.current) {
        telegramLinkButtonRef.current.innerHTML = ''
      }
    }
  }, [confirmLink, isInTelegram, linkProvider])

  const availableLinkProviders = useMemo(() => getAvailableLinkProviders(currentAuthProvider), [currentAuthProvider])

  useEffect(() => {
    if (availableLinkProviders.length === 0) {
      return
    }

    if (!availableLinkProviders.includes(linkProvider)) {
      const fallbackProvider = availableLinkProviders[0]
      if (fallbackProvider) {
        setLinkProvider(fallbackProvider)
      }
    }
  }, [availableLinkProviders, linkProvider])

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 40
    const retryIntervalMs = 125

    const initializeTelegramContext = () => {
      const telegramWebApp = getTelegramWebApp()
      if (!telegramWebApp) {
        return false
      }

      const rawInitData = (telegramWebApp.initData ?? '').trim()
      const hasUserId = Boolean(telegramWebApp.initDataUnsafe?.user?.id)
      const hasQueryId = Boolean(telegramWebApp.initDataUnsafe?.query_id)
      const hasHash = Boolean(telegramWebApp.initDataUnsafe?.hash)
      const isValidTelegramContext = rawInitData.length > 0 && (hasUserId || hasQueryId || hasHash)

      if (!isValidTelegramContext) {
        setIsInTelegram(false)
        setInitDataRaw('')
        setTelegramUser(null)
        return false
      }

      setIsInTelegram(true)
      telegramWebApp.ready()
      telegramWebApp.expand()
      applyTelegramTheme(telegramWebApp.themeParams)

      setInitDataRaw(rawInitData)
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
                setCurrentAuthProvider(null)
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

        <section className={styles.manualSection}>
          <h2>Account Linking</h2>
          {isInTelegram ? (
            <p className={styles.subtitle}>
              Linking is available only in standalone web browser. Open this app outside Telegram to link providers.
            </p>
          ) : null}
          {!isInTelegram && !currentAuthProvider ? (
            <p className={styles.subtitle}>Sign in from web auth page first to enable linking options.</p>
          ) : null}
          {!isInTelegram && currentAuthProvider && availableLinkProviders.length === 0 ? (
            <p className={styles.subtitle}>No linking options available for current auth provider.</p>
          ) : null}
          {!isInTelegram && currentAuthProvider ? (
            <p className={styles.subtitle}>
              Current sign-in provider: <code>{currentAuthProvider}</code>
            </p>
          ) : null}

          {!isInTelegram && currentAuthProvider && availableLinkProviders.length > 0 ? (
            <div className={styles.fieldGrid}>
              <label className={styles.fieldLabel}>
                Provider
                <select
                  className={styles.select}
                  value={linkProvider}
                  onChange={event => setLinkProvider(event.target.value as LinkProvider)}
                >
                  {availableLinkProviders.map(provider => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </label>

              {linkProvider === 'email' ? (
                <>
                  <label className={styles.fieldLabel}>
                    Email
                    <input
                      className={styles.input}
                      type="email"
                      value={linkEmail}
                      onChange={event => setLinkEmail(event.target.value)}
                      placeholder="user@example.com"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Verification Code
                    <input
                      className={styles.input}
                      type="text"
                      inputMode="numeric"
                      value={linkEmailCode}
                      onChange={event => setLinkEmailCode(event.target.value)}
                      placeholder="6-digit code from email"
                    />
                  </label>
                  <span className={styles.subtitle}>
                    In dev mode, backend logs the code as <code>auth_email_link_verification</code>.
                  </span>
                </>
              ) : null}

              {linkProvider === 'google' ? (
                <div className={styles.fieldLabel}>
                  <span>Google Account</span>
                  <div ref={googleLinkButtonRef} className={styles.googleButtonSlot} />
                  {!GOOGLE_CLIENT_ID ? (
                    <span className={styles.error}>Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `apps/frontend/.env`.</span>
                  ) : null}
                  {GOOGLE_CLIENT_ID && !googleLinkButtonReady ? (
                    <span className={styles.subtitle}>Google button is loading...</span>
                  ) : null}
                </div>
              ) : null}

              {linkProvider === 'telegram' ? (
                <div className={styles.fieldLabel}>
                  <span>Telegram Account</span>
                  <div ref={telegramLinkButtonRef} className={styles.googleButtonSlot} />
                  {!TELEGRAM_BOT_PUBLIC_NAME ? (
                    <span className={styles.error}>Set `NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME` in `apps/frontend/.env`.</span>
                  ) : null}
                  {TELEGRAM_BOT_PUBLIC_NAME && !telegramLinkButtonReady ? (
                    <span className={styles.subtitle}>Telegram button is loading...</span>
                  ) : null}
                  <span className={styles.subtitle}>
                    If Telegram shows <code>Bot domain invalid</code>, run <code>/setdomain</code> in BotFather for this
                    frontend domain.
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isInTelegram && currentAuthProvider && availableLinkProviders.length > 0 ? (
            <div className={styles.actions}>
              {linkProvider === 'email' ? (
                <>
                  <button
                    className={styles.primary}
                    type="button"
                    onClick={() => {
                      void requestEmailLinkCode()
                    }}
                    disabled={linkStatus === 'loading'}
                  >
                    {linkStatus === 'loading' ? 'Sending...' : 'Send Verification Code'}
                  </button>
                  <button
                    className={styles.secondary}
                    type="button"
                    onClick={() => {
                      void confirmLink()
                    }}
                    disabled={linkStatus === 'loading'}
                  >
                    {linkStatus === 'loading' ? 'Linking...' : 'Confirm Code & Link'}
                  </button>
                </>
              ) : null}
              {linkProvider === 'telegram' ? (
                <button className={styles.secondary} type="button" disabled>
                  Use Telegram Button Above
                </button>
              ) : null}

              <button
                className={styles.secondary}
                type="button"
                onClick={() => {
                  setLinkEmail('')
                  setLinkEmailCode('')
                  setLinkError(null)
                  setLinkMessage(null)
                  setLinkStatus('idle')
                }}
                disabled={linkStatus === 'loading'}
              >
                Reset Linking Form
              </button>
            </div>
          ) : null}

          {linkMessage ? <p className={styles.success}>{linkMessage}</p> : null}
          {linkError ? <p className={styles.error}>Error: {linkError}</p> : null}
        </section>

        <nav className={styles.navLinks}>
          <Link href="/auth/register">Web: Register</Link>
          <Link href="/auth/login">Web: Login</Link>
          <Link href="/auth/google">Web: Google</Link>
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

function getAvailableLinkProviders(currentProvider: AuthProvider | null): LinkProvider[] {
  if (currentProvider === 'google') {
    return ['email', 'telegram']
  }

  if (currentProvider === 'email') {
    return ['google', 'telegram']
  }

  if (currentProvider === 'telegram') {
    return ['email', 'google']
  }

  return []
}
