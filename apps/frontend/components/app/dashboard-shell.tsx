'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { type AuthProvider, type AuthResponse, readStoredAuthProvider, readStoredSession } from '@/lib/auth-client'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'
import { useI18n } from './i18n-provider'

interface DashboardShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
}

interface NavItem {
  href: '/dashboard' | '/dashboard/linking'
  label: string
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  const [session, setSession] = useState<AuthResponse | null>(null)
  const [provider, setProvider] = useState<AuthProvider | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { isInTelegram } = useTelegramMiniApp()

  useEffect(() => {
    setSession(readStoredSession())
    setProvider(readStoredAuthProvider())
  }, [])

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [{ href: '/dashboard', label: t('dashboard.overview') }]
    if (isInTelegram === false) {
      items.push({ href: '/dashboard/linking', label: t('dashboard.linked') })
    }
    return items
  }, [isInTelegram, t])

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription>{subtitle}</CardDescription>
              </div>
              {isInTelegram === false ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:inline-flex"
                  onClick={() => setSidebarCollapsed(currentState => !currentState)}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t('dashboard.sessionReady')}</Badge>
              <Badge variant="outline">{session.user.role}</Badge>
              {provider ? <Badge variant="outline">{provider}</Badge> : null}
            </div>
          </CardHeader>
        </Card>

        {isInTelegram === true ? (
          <div className="flex flex-wrap gap-2">
            <span className="mr-2 self-center text-sm text-muted-foreground">{t('dashboard.telegramMenu')}:</span>
            {navItems.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant={active ? 'default' : 'outline'} size="sm">
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>
        ) : isInTelegram === false ? (
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="h-4 w-4" />
                  {t('dashboard.telegramMenu')}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetTitle className="sr-only">{t('dashboard.telegramMenu')}</SheetTitle>
                <div className="mt-6 space-y-2">
                  {navItems.map(item => {
                    const active = pathname === item.href
                    return (
                      <Link key={item.href} href={item.href}>
                        <Button className="w-full justify-start" variant={active ? 'default' : 'ghost'}>
                          {item.label}
                        </Button>
                      </Link>
                    )
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          {isInTelegram === false ? (
            <aside className={cn('hidden rounded-lg border bg-card p-3 md:block', sidebarCollapsed ? 'w-20' : 'w-64')}>
              <div className="space-y-2">
                {navItems.map(item => {
                  const active = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button className="w-full justify-start" variant={active ? 'default' : 'ghost'}>
                        {sidebarCollapsed ? item.label.slice(0, 1) : item.label}
                      </Button>
                    </Link>
                  )
                })}
              </div>
              <Separator className="my-3" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {t('dashboard.userId')}: {session.user.id.slice(0, 8)}...
                </p>
                <p>
                  {t('dashboard.provider')}: {provider ?? '—'}
                </p>
                <p>
                  {t('dashboard.email')}: {session.user.email ?? '—'}
                </p>
              </div>
            </aside>
          ) : null}

          <section className="space-y-6">{children}</section>
        </div>
      </div>
    </AppShell>
  )
}
