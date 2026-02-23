'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/app/dashboard-shell'
import { useI18n } from '@/components/app/i18n-provider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type AuthProvider, type AuthResponse, readStoredAuthProvider, readStoredSession } from '@/lib/auth-client'

export default function DashboardPage() {
  const { t } = useI18n()

  const [session, setSession] = useState<AuthResponse | null>(null)
  const [provider, setProvider] = useState<AuthProvider | null>(null)

  useEffect(() => {
    setSession(readStoredSession())
    setProvider(readStoredAuthProvider())
  }, [])

  return (
    <DashboardShell title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.overview')}</CardTitle>
            <CardDescription>{t('dashboard.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('dashboard.userId')}:</span>
              <span className="font-mono">{session?.user.id ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('dashboard.role')}:</span>
              <Badge variant="outline">{session?.user.role ?? '—'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t('dashboard.provider')}:</span>
              <Badge variant="secondary">{provider ?? '—'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.session')}</CardTitle>
            <CardDescription>{t('dashboard.sessionReady')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t('dashboard.email')}: {session?.user.email ?? '—'}
            </p>
            <p>{t('dashboard.linked')}</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
