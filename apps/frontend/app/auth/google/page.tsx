'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [selectedCredential, setSelectedCredential] = useState<string | null>(null)
  const [selectedAccountLabel, setSelectedAccountLabel] = useState<string | null>(null)
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
      router.replace('/')
      router.refresh()
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : String(authError)
      setStatus('error')
      setError(message)
    }
  }, [router])

  useEffect(() => {
    if (isInTelegram === true || !GOOGLE_CLIENT_ID || !buttonContainerRef.current || selectedCredential) {
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
        const accountLabel = parseGoogleAccountLabel(credential)
        setSelectedCredential(credential)
        setSelectedAccountLabel(accountLabel)
        setStatus('idle')
        setError(null)
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
  }, [isInTelegram, selectedCredential])

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
          {selectedCredential ? (
            <Button className="w-full justify-start text-left" variant="outline" disabled>
              {selectedAccountLabel ?? t('auth.googleSelectedFallback')}
            </Button>
          ) : (
            <div ref={buttonContainerRef} className="min-h-10" />
          )}

          {!selectedCredential && !sdkReady ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
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
            <Button
              onClick={() => {
                if (selectedCredential && status !== 'loading') {
                  void authenticate(selectedCredential)
                }
              }}
              disabled={status === 'loading' || !selectedCredential}
            >
              {status === 'loading' ? t('common.loading') : t('auth.submitLogin')}
            </Button>
            {selectedCredential ? (
              <Button
                variant="outline"
                disabled={status === 'loading'}
                onClick={() => {
                  setSelectedCredential(null)
                  setSelectedAccountLabel(null)
                  setStatus('idle')
                  setError(null)
                }}
              >
                {t('auth.googleChangeAccount')}
              </Button>
            ) : null}
          </div>

          {!selectedCredential ? (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <Link className="text-foreground underline" href="/auth/login">
                {t('auth.loginTitle')}
              </Link>
              <Link className="text-foreground underline" href="/auth/register">
                {t('auth.registerTitle')}
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  )
}

interface GoogleTokenPayload {
  email?: string
  name?: string
  given_name?: string
}

function parseGoogleAccountLabel(idToken: string): string {
  try {
    const [, encodedPayload] = idToken.split('.')
    if (!encodedPayload) {
      return ''
    }

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const payloadJson = atob(padded)
    const payload = JSON.parse(payloadJson) as GoogleTokenPayload
    return payload.email?.trim() || payload.name?.trim() || payload.given_name?.trim() || ''
  } catch {
    return ''
  }
}
