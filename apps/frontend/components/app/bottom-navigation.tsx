'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, NotebookText, UserRound } from 'lucide-react'
import { useI18n } from '@/components/app/i18n-provider'
import { isNavHrefActive } from '@/lib/navigation'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'
import { cn } from '@/lib/utils'

interface NavItem {
  href: '/' | '/dashboard/notes' | '/dashboard'
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function BottomNavigation() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { isInTelegram } = useTelegramMiniApp()

  if (isInTelegram !== true) {
    return null
  }

  const items: NavItem[] = [
    { href: '/', label: t('nav.welcome'), icon: Home },
    { href: '/dashboard/notes', label: t('nav.notes'), icon: NotebookText },
    { href: '/dashboard', label: t('nav.dashboard'), icon: UserRound },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div className="mx-auto max-w-6xl rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="grid grid-cols-3 gap-1.5">
        {items.map(item => {
          const Icon = item.icon
          const isActive = isNavHrefActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium',
                'transition-colors hover:bg-muted',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        </div>
      </div>
    </nav>
  )
}
