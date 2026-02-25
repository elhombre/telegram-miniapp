'use client'

import Link from 'next/link'
import { Globe2, Languages, Link2, LockKeyhole, NotebookText, Palette } from 'lucide-react'
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

interface FeatureItem {
  icon: React.ComponentType<{ className?: string }>
  text: string
}

export default function WelcomePage() {
  const { t } = useI18n()
  const { isInTelegram, initDataRaw } = useTelegramMiniApp({
    waitForSignedData: true,
    maxAttempts: 40,
    intervalMs: 150,
  })

  const [session, setSession] = useState<AuthResponse | null>(null)
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>('idle')
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const authStartedRef = useRef(false)

  const features: FeatureItem[] = [
    { icon: LockKeyhole, text: t('welcome.features.authProviders') },
    { icon: Link2, text: t('welcome.features.linking') },
    { icon: NotebookText, text: t('welcome.features.notes') },
    { icon: Languages, text: t('welcome.features.i18n') },
    { icon: Palette, text: t('welcome.features.theme') },
    { icon: Globe2, text: t('welcome.features.platforms') },
  ]

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
    if (isInTelegram === true) {
      setSession(null)
      return
    }

    const storedSession = readStoredSession()
    if (storedSession) {
      setSession(storedSession)
    }
  }, [isInTelegram])

  useEffect(() => {
    if (isInTelegram !== true || !initDataRaw || authStartedRef.current) {
      return
    }

    authStartedRef.current = true
    void authorizeTelegram(initDataRaw)
  }, [authorizeTelegram, initDataRaw, isInTelegram])

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-5">
            <Badge variant="outline" className="w-fit">
              {t('welcome.badge')}
            </Badge>
            <div className="space-y-3">
              <CardTitle className="text-3xl leading-tight sm:text-4xl">{t('welcome.title')}</CardTitle>
              <CardDescription className="max-w-3xl text-base">{t('welcome.subtitle')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {isInTelegram === true ? (
                <>
                  <Link href="/dashboard/notes">
                    <Button className="min-h-11">{t('welcome.openNotes')}</Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="secondary" className="min-h-11">
                      {t('welcome.openProfile')}
                    </Button>
                  </Link>
                </>
              ) : session ? (
                <>
                  <Link href="/dashboard">
                    <Button className="min-h-11">{t('welcome.openDashboard')}</Button>
                  </Link>
                  <Link href="/dashboard/notes">
                    <Button variant="secondary" className="min-h-11">
                      {t('welcome.openNotes')}
                    </Button>
                  </Link>
                </>
              ) : isInTelegram === false ? (
                <>
                  <Link href="/auth/login">
                    <Button className="min-h-11">{t('welcome.openLogin')}</Button>
                  </Link>
                  <Link href="/auth/register">
                    <Button variant="secondary" className="min-h-11">
                      {t('welcome.openRegister')}
                    </Button>
                  </Link>
                </>
              ) : null}
            </div>

            {isInTelegram === true ? (
              <p className="text-sm text-muted-foreground">{t('welcome.inTelegram')}</p>
            ) : null}
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
          <h2 className="text-2xl font-semibold">{t('welcome.features.title')}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {features.map(item => {
              const Icon = item.icon
              return (
                <Card key={item.text}>
                  <CardContent className="flex items-start gap-3 pt-6">
                    <Icon className="mt-0.5 h-5 w-5 text-primary" />
                    <p className="text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
