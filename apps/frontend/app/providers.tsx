'use client'

import { I18nProvider } from '@/components/app/i18n-provider'
import { ThemeProvider } from '@/components/app/theme-provider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  )
}
