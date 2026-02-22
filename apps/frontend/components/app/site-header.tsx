'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleUserRound, LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { isNavHrefActive } from '@/lib/navigation'
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
  const isWebMode = isInTelegram === false

  const navItems: Array<{ href: '/' | '/dashboard/notes' | '/dashboard'; label: string }> = [
    { href: '/', label: t('nav.welcome') },
    { href: '/dashboard/notes', label: t('nav.notes') },
    { href: '/dashboard', label: t('nav.dashboard') },
  ]

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 pt-safe sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight transition-opacity hover:opacity-80">
          {t('app.name')}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map(item => {
            const active = isNavHrefActive(pathname, item.href)
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors',
                    active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted',
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

          {session && isWebMode ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-9">
                  <CircleUserRound className="h-4 w-4" />
                  <span className="sr-only">{t('nav.dashboard')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <UserRound className="h-4 w-4" />
                    {t('nav.dashboard')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : isWebMode ? (
            <>
              <Link href="/auth/login">
                <Button variant="outline" size="sm" className="min-h-11">
                  {t('nav.login')}
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button size="sm" className="min-h-11">
                  {t('nav.register')}
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
