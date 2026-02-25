'use client'

import Link from 'next/link'
import { DashboardShell } from '@/components/app/dashboard-shell'
import { LinkingPanel } from '@/components/app/linking-panel'
import { useI18n } from '@/components/app/i18n-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'

export default function DashboardLinkingPage() {
  const { t } = useI18n()
  const { isInTelegram } = useTelegramMiniApp()

  if (isInTelegram !== false) {
    return (
      <DashboardShell title={t('linking.title')} subtitle={t('linking.subtitle')}>
        <Card>
          <CardHeader>
            <CardTitle>{isInTelegram === true ? t('linking.title') : t('common.loading')}</CardTitle>
            {isInTelegram === true ? <CardDescription>{t('linking.browserOnly')}</CardDescription> : null}
          </CardHeader>
          <CardContent>
            {isInTelegram === true ? (
              <Link href="/dashboard">
                <Button>{t('dashboard.overview')}</Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title={t('linking.title')} subtitle={t('linking.subtitle')}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.linkingMovedTitle')}</CardTitle>
          <CardDescription>{t('dashboard.linkingMovedDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">{t('dashboard.overview')}</Badge>
          <Link href="/dashboard">
            <Button variant="outline">{t('dashboard.openProfile')}</Button>
          </Link>
        </CardContent>
      </Card>
      <LinkingPanel />
    </DashboardShell>
  )
}
