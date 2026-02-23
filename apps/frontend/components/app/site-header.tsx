'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'
import { cn } from '@/lib/utils'
import type { AuthResponse } from '@/lib/auth-client'
import { useI18n } from './i18n-provider'
import { LanguageSwitcher } from './language-switcher'
import { ThemeToggle } from './theme-toggle'

interface SiteHeaderProps {
  session: AuthResponse | null
  onLogout?: () => void
}

export function SiteHeader({ session, onLogout }: SiteHeaderProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const { isInTelegram } = useTelegramMiniApp()

  const navItems = [
    { href: '/', label: t('nav.welcome') },
    { href: '/dashboard', label: t('nav.dashboard') },
    ...(isInTelegram === false ? [{ href: '/dashboard/linking', label: t('nav.linking') }] : []),
  ]

  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold transition-opacity hover:opacity-80">
          {t('app.name')}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(item => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    'inline-flex h-8 items-center rounded-md px-3 text-sm transition-colors',
                    active && 'bg-secondary',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {session && isInTelegram === false ? (
            <Button variant="outline" size="sm" onClick={onLogout}>
              {t('nav.logout')}
            </Button>
          ) : isInTelegram === false ? (
            <>
              <Link href="/auth/login">
                <Button variant="outline" size="sm">
                  {t('nav.login')}
                </Button>
              </Link>
              <Link href="/auth/register" className="hidden sm:block">
                <Button size="sm">{t('nav.register')}</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
