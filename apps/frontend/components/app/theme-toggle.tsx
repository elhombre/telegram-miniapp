'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useI18n } from './i18n-provider'

type ThemeMode = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="h-9 w-9" aria-label={t('theme.label')} title={t('theme.label')}>
        <Monitor className="h-4 w-4" />
        <span className="sr-only">{t('theme.label')}</span>
      </Button>
    )
  }

  const currentTheme = toThemeMode(theme)
  const nextTheme = getNextTheme(currentTheme)

  const currentThemeLabel = t(`theme.${currentTheme}`)
  const nextThemeLabel = t(`theme.${nextTheme}`)
  const resolvedThemeLabel = t(`theme.${toThemeMode(resolvedTheme)}`)

  const label =
    currentTheme === 'system'
      ? t('theme.toggleWithResolved', {
          current: currentThemeLabel,
          resolved: resolvedThemeLabel,
          next: nextThemeLabel,
        })
      : t('theme.toggle', {
          current: currentThemeLabel,
          next: nextThemeLabel,
        })

  const Icon = getThemeIcon(currentTheme)

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function toThemeMode(value: string | undefined): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  return 'system'
}

function getNextTheme(currentTheme: ThemeMode): ThemeMode {
  if (currentTheme === 'light') {
    return 'dark'
  }

  if (currentTheme === 'dark') {
    return 'system'
  }

  return 'light'
}

function getThemeIcon(currentTheme: ThemeMode) {
  if (currentTheme === 'light') {
    return Sun
  }

  if (currentTheme === 'dark') {
    return Moon
  }

  return Monitor
}
