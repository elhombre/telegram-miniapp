'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n, type Locale } from './i18n-provider'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  const label = locale === 'ru' ? 'RU' : 'EN'

  return (
    <Select value={locale} onValueChange={value => setLocale(value as Locale)}>
      <SelectTrigger className="h-9 w-20" aria-label={t('language.label')}>
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">EN · {t('language.en')}</SelectItem>
        <SelectItem value="ru">RU · {t('language.ru')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
