'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from '../auth.module.css'
import { getCurrentApiMode, getGoogleCallbackEndpoint } from '../../../lib/api'
import {
  type AuthResponse,
  maskToken,
  parseApiError,
  persistAuthProvider,
  persistAuthSession,
  readStoredSession,
} from '../../../lib/auth-client'
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, renderGoogleSignInButton } from '../../../lib/google-identity'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

const API_MODE = getCurrentApiMode()

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
      persistAuthProvider('google')
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

      if (isCancelled || !buttonContainerRef.current) {
        return
      }

      renderGoogleSignInButton(buttonContainerRef.current, credential => {
        setManualIdToken(credential)
        void authenticateWithGoogleToken(credential)
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
