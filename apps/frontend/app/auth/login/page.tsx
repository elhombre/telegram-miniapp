'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { useI18n } from '@/components/app/i18n-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getEmailLoginEndpoint } from '@/lib/api'
import { type AuthResponse, parseApiError, persistAuthProvider, persistAuthSession } from '@/lib/auth-client'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

export default function LoginPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isLinkingMode, setIsLinkingMode] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<AuthResponse | null>(null)
  const { isInTelegram } = useTelegramMiniApp()

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length >= 8, [email, password])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setIsLinkingMode(params.get('mode') === 'linking')
  }, [])

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
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          {isLinkingMode ? <Badge className="w-fit">{t('auth.linkingMode')}</Badge> : null}
          <CardTitle>{t('auth.loginTitle')}</CardTitle>
          <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
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
                persistAuthProvider('email')
                setSession(payload)
                setStatus('success')
                router.replace('/')
                router.refresh()
              } catch (submitError) {
                const message = submitError instanceof Error ? submitError.message : String(submitError)
                setStatus('error')
                setError(message)
              }
            }}
          >
            <div className="space-y-2">
              <Label>{t('common.email')}</Label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t('common.password')}</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" type="submit" disabled={status === 'loading' || !canSubmit}>
                {status === 'loading' ? t('common.loading') : t('auth.submitLogin')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={status === 'loading'}
                onClick={() => {
                  setEmail('')
                  setPassword('')
                  setStatus('idle')
                  setError(null)
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>

          {status === 'success' ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{t('auth.sessionReady')}</p>
          ) : null}
          {status === 'error' && error ? (
            <p className="mt-3 text-sm text-destructive">
              {t('common.error')}: {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{t('auth.noAccount')}</span>
            <Link className="text-foreground underline" href="/auth/register">
              {t('nav.register')}
            </Link>
            {!isLinkingMode ? (
              <Link className="text-foreground underline" href="/auth/google">
                {t('nav.google')}
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}
