'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import styles from '../auth.module.css'
import { getCurrentApiMode, getEmailLoginEndpoint } from '../../../lib/api'
import { type AuthResponse, maskToken, parseApiError, persistAuthSession, readStoredSession } from '../../../lib/auth-client'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

const API_MODE = getCurrentApiMode()

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<AuthResponse | null>(null)

  const isFormValid = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8
  }, [email, password])

  useEffect(() => {
    const storedSession = readStoredSession()
    if (storedSession) {
      setSession(storedSession)
    }
  }, [])

  return (
    <div className={styles.page}>
      <main className={styles.panel}>
        <header>
          <p className={styles.kicker}>Web Auth</p>
          <h1 className={styles.title}>Sign In</h1>
          <p className={styles.subtitle}>Email/password login for standalone web frontend.</p>
        </header>

        <section className={styles.meta}>
          <p>API mode: {API_MODE}</p>
          <p>Endpoint: {getEmailLoginEndpoint()}</p>
        </section>

        <form
          className={styles.form}
          onSubmit={async event => {
            event.preventDefault()
            setStatus('loading')
            setError(null)

            try {
              const response = await fetch(getEmailLoginEndpoint(), {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  email: email.trim(),
                  password,
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
          }}
        >
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={status === 'loading' || !isFormValid}>
              {status === 'loading' ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => {
                setEmail('')
                setPassword('')
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
        {status === 'success' ? <p className={styles.success}>Logged in, session stored.</p> : null}

        {session ? (
          <section className={styles.sessionCard}>
            <p>User ID: {session.user.id}</p>
            <p>Email: {session.user.email ?? '—'}</p>
            <p>Role: {session.user.role}</p>
            <p>Access: {maskToken(session.accessToken)}</p>
          </section>
        ) : null}

        <nav className={styles.links}>
          <Link href="/auth/register">Create account</Link>
          <Link href="/auth/google">Google sign-in</Link>
          <Link href="/">Open mini app screen</Link>
        </nav>
      </main>
    </div>
  )
}
