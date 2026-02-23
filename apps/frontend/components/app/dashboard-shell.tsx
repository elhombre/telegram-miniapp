'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Link2, Menu, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
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
  icon: LucideIcon
}

let dashboardSessionCache: AuthResponse | null | undefined
let dashboardProviderCache: AuthProvider | null | undefined

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  const [session, setSession] = useState<AuthResponse | null>(() => {
    return dashboardSessionCache ?? null
  })
  const [provider, setProvider] = useState<AuthProvider | null>(() => {
    return dashboardProviderCache ?? null
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { isInTelegram } = useTelegramMiniApp()

  useEffect(() => {
    const nextSession = readStoredSession()
    const nextProvider = readStoredAuthProvider()
    dashboardSessionCache = nextSession
    dashboardProviderCache = nextProvider
    setSession(nextSession)
    setProvider(nextProvider)
  }, [])

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [{ href: '/dashboard', label: t('dashboard.overview'), icon: LayoutDashboard }]
    if (isInTelegram === false) {
      items.push({ href: '/dashboard/linking', label: t('dashboard.linked'), icon: Link2 })
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

  const summaryCard = (
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
  )

  return (
    <AppShell session={session}>
      <div className="space-y-6">
        {isInTelegram === true ? (
          <>
            {summaryCard}
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
            <section className="space-y-6">{children}</section>
          </>
        ) : isInTelegram === false ? (
          <>
            <div className="md:hidden">{summaryCard}</div>
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

            <div className="grid items-stretch gap-6 md:grid-cols-[auto_1fr]">
              <aside
                className={cn(
                  'hidden rounded-lg border bg-card transition-[width,padding] duration-200 ease-in-out md:flex md:h-full md:flex-col',
                  sidebarCollapsed ? 'w-16 p-2' : 'w-64 p-3',
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 transition-[padding,justify-content] duration-200 ease-in-out',
                    sidebarCollapsed ? 'w-full justify-center gap-0 px-0' : 'w-full justify-start gap-2 px-3',
                  )}
                  onClick={() => setSidebarCollapsed(currentState => !currentState)}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>

                <Separator className="my-2" />

                <div className="space-y-2">
                  {navItems.map(item => {
                    const active = pathname === item.href
                    const ItemIcon = item.icon
                    return (
                      <Link key={item.href} href={item.href}>
                      <Button
                        className={cn(
                          'h-9 w-full transition-[padding,justify-content] duration-200 ease-in-out',
                          sidebarCollapsed ? 'justify-center gap-0 px-0' : 'justify-start gap-2 px-3',
                        )}
                        variant={active ? 'default' : 'ghost'}
                      >
                        <ItemIcon className="h-4 w-4 shrink-0" />
                        <span
                          className={cn(
                            'overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-150 ease-in-out',
                            sidebarCollapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2 max-w-40 opacity-100',
                          )}
                          aria-hidden={sidebarCollapsed}
                        >
                          {item.label}
                        </span>
                      </Button>
                    </Link>
                  )
                })}
              </div>

              <div
                className={cn(
                  'overflow-hidden transition-[max-height,opacity,margin] duration-150 ease-in-out',
                  sidebarCollapsed ? 'mt-0 max-h-0 opacity-0' : 'mt-3 max-h-40 opacity-100',
                )}
                aria-hidden={sidebarCollapsed}
              >
                <Separator className="mb-3" />
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
              </div>
              </aside>

              <div className="space-y-6">
                <div className="hidden md:block">{summaryCard}</div>
                <section className="space-y-6">{children}</section>
              </div>
            </div>
          </>
        ) : (
          <>
            {summaryCard}
            <section className="space-y-6">{children}</section>
          </>
        )}
      </div>
    </AppShell>
  )
}
