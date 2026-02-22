'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type AuthProvider, type AuthResponse, readStoredAuthProvider, readStoredSession } from '@/lib/auth-client'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'
import { useI18n } from './i18n-provider'

interface DashboardShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const { t } = useI18n()
  const { isInTelegram } = useTelegramMiniApp()
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [provider, setProvider] = useState<AuthProvider | null>(null)

  useEffect(() => {
    setSession(readStoredSession())
    setProvider(readStoredAuthProvider())
  }, [])

  if (!session) {
    return (
      <AppShell session={null}>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>{t('dashboard.needAuth')}</CardTitle>
            <CardDescription>{t('dashboard.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isInTelegram === true ? (
              <Link href="/">
                <Button>{t('nav.welcome')}</Button>
              </Link>
            ) : isInTelegram === false ? (
              <Link href="/auth/login">
                <Button>{t('dashboard.continueToLogin')}</Button>
              </Link>
            ) : (
              <Button disabled>{t('common.loading')}</Button>
            )}
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t('dashboard.sessionReady')}</Badge>
              <Badge variant="outline">{session.user.role}</Badge>
              {provider ? <Badge variant="outline">{provider}</Badge> : null}
            </div>
          </CardHeader>
        </Card>

        <section className="space-y-6">{children}</section>
      </div>
    </AppShell>
  )
}
