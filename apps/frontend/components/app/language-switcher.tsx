'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n, type Locale } from './i18n-provider'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <Select value={locale} onValueChange={value => setLocale(value as Locale)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={t('language.label')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{t('language.en')}</SelectItem>
        <SelectItem value="ru">{t('language.ru')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
