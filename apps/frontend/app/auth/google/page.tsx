'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../auth.module.css'
import { getCurrentApiMode, getGoogleCallbackEndpoint } from '../../../lib/api'
import { type AuthResponse, maskToken, parseApiError, persistAuthSession, readStoredSession } from '../../../lib/auth-client'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

const API_MODE = getCurrentApiMode()
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ''
const GOOGLE_SDK_SCRIPT_ID = 'google-identity-services-sdk'

export default function GooglePage() {
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [manualIdToken, setManualIdToken] = useState('')
  const [sdkReady, setSdkReady] = useState(false)
  const buttonContainerRef = useRef<HTMLDivElement | null>(null)

  const authenticateWithGoogleToken = useCallback(async (idToken: string) => {
    setStatus('loading')
    setError(null)

    try {
      const response = await fetch(getGoogleCallbackEndpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as AuthResponse
      persistAuthSession(payload)
      setSession(payload)
      setStatus('success')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : String(submitError)
      setStatus('error')
      setError(message)
    }
  }, [])

  useEffect(() => {
    const storedSession = readStoredSession()
    if (storedSession) {
      setSession(storedSession)
    }
  }, [])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setSdkReady(false)
      return
    }

    let isCancelled = false

    const initialize = async () => {
      try {
        await loadGoogleIdentityScript()
      } catch (loadError) {
        if (!isCancelled) {
          const message = loadError instanceof Error ? loadError.message : String(loadError)
          setStatus('error')
          setError(message)
        }
        return
      }

      if (isCancelled || !window.google?.accounts?.id || !buttonContainerRef.current) {
        return
      }

      buttonContainerRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: response => {
          const credential = response.credential?.trim()
          if (!credential) {
            setStatus('error')
            setError('Google did not return idToken credential')
            return
          }

          setManualIdToken(credential)
          void authenticateWithGoogleToken(credential)
        },
      })
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
      })
      setSdkReady(true)
    }

    void initialize()

    return () => {
      isCancelled = true
    }
  }, [authenticateWithGoogleToken])

  return (
    <div className={styles.page}>
      <main className={styles.panel}>
        <header>
          <p className={styles.kicker}>Web Auth</p>
          <h1 className={styles.title}>Google Sign-In</h1>
          <p className={styles.subtitle}>Use Google Identity Services to obtain ID token and exchange it on backend.</p>
        </header>

        <section className={styles.meta}>
          <p>API mode: {API_MODE}</p>
          <p>Endpoint: {getGoogleCallbackEndpoint()}</p>
          <p>Client ID configured: {GOOGLE_CLIENT_ID ? 'yes' : 'no'}</p>
        </section>

        <section className={styles.form}>
          <div ref={buttonContainerRef} />
          {!sdkReady ? <p className={styles.subtitle}>Google button is unavailable until SDK is initialized.</p> : null}
          {!GOOGLE_CLIENT_ID ? (
            <p className={styles.error}>Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `apps/frontend/.env`.</p>
          ) : null}
        </section>

        <form
          className={styles.form}
          onSubmit={async event => {
            event.preventDefault()

            const token = manualIdToken.trim()
            if (!token) {
              setStatus('error')
              setError('idToken is required')
              return
            }

            await authenticateWithGoogleToken(token)
          }}
        >
          <label className={styles.label}>
            Manual idToken (debug fallback)
            <input
              className={styles.input}
              type="text"
              value={manualIdToken}
              onChange={event => setManualIdToken(event.target.value)}
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI..."
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Authorizing...' : 'Authorize with idToken'}
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                setManualIdToken('')
                setStatus('idle')
                setError(null)
              }}
              disabled={status === 'loading'}
            >
              Reset
            </button>
          </div>
        </form>

        {status === 'error' && error ? <p className={styles.error}>Error: {error}</p> : null}
        {status === 'success' ? <p className={styles.success}>Google session established.</p> : null}

        {session ? (
          <section className={styles.sessionCard}>
            <p>User ID: {session.user.id}</p>
            <p>Email: {session.user.email ?? '—'}</p>
            <p>Role: {session.user.role}</p>
            <p>Access: {maskToken(session.accessToken)}</p>
          </section>
        ) : null}

        <nav className={styles.links}>
          <Link href="/auth/register">Email register</Link>
          <Link href="/auth/login">Email login</Link>
          <Link href="/">Open mini app screen</Link>
        </nav>
      </main>
    </div>
  )
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  const existingScript = document.getElementById(GOOGLE_SDK_SCRIPT_ID) as HTMLScriptElement | null
  if (existingScript) {
    return waitForGoogleObject()
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = GOOGLE_SDK_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      void waitForGoogleObject().then(resolve).catch(reject)
    }
    script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'))
    document.head.appendChild(script)
  })
}

function waitForGoogleObject(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 60

    const intervalId = window.setInterval(() => {
      attempts += 1
      if (window.google?.accounts?.id) {
        window.clearInterval(intervalId)
        resolve()
        return
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(intervalId)
        reject(new Error('Google Identity Services SDK is loaded but unavailable'))
      }
    }, 50)
  })
}

declare global {
  interface Window {
    google?: GoogleIdentityWindow
  }
}

interface GoogleIdentityWindow {
  accounts?: {
    id?: {
      initialize: (options: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
      }) => void
      renderButton: (
        parent: HTMLElement,
        options: {
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          size?: 'small' | 'medium' | 'large'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
        },
      ) => void
    }
  }
}

interface GoogleCredentialResponse {
  credential?: string
}
