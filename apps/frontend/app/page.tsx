'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { useI18n } from '@/components/app/i18n-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getTelegramVerifyInitDataEndpoint } from '@/lib/api'
import {
  type AuthResponse,
  parseApiError,
  persistAuthProvider,
  persistAuthSession,
  readStoredSession,
} from '@/lib/auth-client'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'

type BootstrapStatus = 'idle' | 'loading' | 'success' | 'error'

export default function WelcomePage() {
  const { t } = useI18n()
  const { isInTelegram, initDataRaw } = useTelegramMiniApp({ waitForSignedData: true, maxAttempts: 20 })

  const [session, setSession] = useState<AuthResponse | null>(null)
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>('idle')
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const authStartedRef = useRef(false)

  const authorizeTelegram = useCallback(async (rawInitData: string) => {
    setBootstrapStatus('loading')
    setBootstrapError(null)

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
      persistAuthSession(payload)
      persistAuthProvider('telegram')
      setSession(payload)
      setBootstrapStatus('success')
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : String(authError)
      setBootstrapStatus('error')
      setBootstrapError(message)
    }
  }, [])

  useEffect(() => {
    const storedSession = readStoredSession()
    if (storedSession) {
      setSession(storedSession)
    }
  }, [])

  useEffect(() => {
    if (session || isInTelegram !== true || !initDataRaw || authStartedRef.current) {
      return
    }

    authStartedRef.current = true
    void authorizeTelegram(initDataRaw)
  }, [authorizeTelegram, initDataRaw, isInTelegram, session])

  return (
    <AppShell session={session}>
      <div className="space-y-8">
        <Card>
          <CardHeader className="space-y-4">
            <Badge variant="outline" className="w-fit">
              {t('welcome.badge')}
            </Badge>
            <CardTitle>{t('welcome.title')}</CardTitle>
            <CardDescription>{t('welcome.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {session ? (
                <Link href="/dashboard">
                  <Button>{t('welcome.openDashboard')}</Button>
                </Link>
              ) : isInTelegram === false ? (
                <>
                  <Link href="/auth/login">
                    <Button>{t('welcome.openLogin')}</Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button variant="secondary">{t('welcome.openRegister')}</Button>
                  </Link>
                </>
              ) : null}
            </div>

            {isInTelegram ? <p className="text-sm text-muted-foreground">{t('welcome.inTelegram')}</p> : null}
            {bootstrapStatus === 'loading' ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : null}
            {bootstrapStatus === 'error' ? (
              <p className="text-sm text-destructive">
                {t('welcome.bootstrapError')}
                {bootstrapError ? ` (${bootstrapError})` : ''}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('welcome.features.title')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">{t('welcome.features.identity')}</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">{t('welcome.features.security')}</CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">{t('welcome.features.ux')}</CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
