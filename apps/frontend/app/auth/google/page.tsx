'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { useI18n } from '@/components/app/i18n-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getGoogleCallbackEndpoint } from '@/lib/api'
import { type AuthResponse, parseApiError, persistAuthProvider, persistAuthSession } from '@/lib/auth-client'
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, renderGoogleSignInButton } from '@/lib/google-identity'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

export default function GooglePage() {
  const { t } = useI18n()

  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const { isInTelegram } = useTelegramMiniApp()

  const buttonContainerRef = useRef<HTMLDivElement | null>(null)

  const authenticate = useCallback(async (idToken: string) => {
    setStatus('loading')
    setError(null)

    try {
      const response = await fetch(getGoogleCallbackEndpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as AuthResponse
      persistAuthSession(payload)
      persistAuthProvider('google')
      setSession(payload)
      setStatus('success')
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : String(authError)
      setStatus('error')
      setError(message)
    }
  }, [])

  useEffect(() => {
    if (isInTelegram === true || !GOOGLE_CLIENT_ID || !buttonContainerRef.current) {
      setSdkReady(false)
      return
    }

    let cancelled = false

    const initialize = async () => {
      try {
        await loadGoogleIdentityScript()
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : String(loadError)
          setStatus('error')
          setError(message)
        }
        return
      }

      if (cancelled || !buttonContainerRef.current) {
        return
      }

      renderGoogleSignInButton(buttonContainerRef.current, credential => {
        void authenticate(credential)
      })
      setSdkReady(true)
    }

    void initialize()

    return () => {
      cancelled = true
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = ''
      }
    }
  }, [authenticate, isInTelegram])

  if (isInTelegram !== false) {
    return (
      <AppShell session={session}>
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>{isInTelegram === true ? t('auth.browserOnlyTitle') : t('common.loading')}</CardTitle>
            {isInTelegram === true ? <CardDescription>{t('auth.browserOnlyDescription')}</CardDescription> : null}
          </CardHeader>
          <CardContent>
            {isInTelegram === true ? (
              <Link href="/">
                <Button>{t('nav.welcome')}</Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell session={session}>
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.googleTitle')}</CardTitle>
          <CardDescription>{t('auth.googleSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={buttonContainerRef} className="min-h-10" />
          {!sdkReady ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
          {!GOOGLE_CLIENT_ID ? (
            <p className="text-sm text-destructive">Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `apps/frontend/.env`.</p>
          ) : null}

          {status === 'success' ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('auth.sessionReady')}</p>
          ) : null}
          {status === 'error' && error ? (
            <p className="text-sm text-destructive">
              {t('common.error')}: {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/auth/login">
              <Button variant="outline">{t('nav.login')}</Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="outline">{t('nav.register')}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
