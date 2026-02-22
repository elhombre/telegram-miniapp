'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'
import { getTelegramWebApp } from '@/lib/telegram'

const LOCALE_STORAGE_KEY = 'miniapp.locale'

export type Locale = 'en' | 'ru'

type Dictionary = typeof en

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string>) => string
}

const dictionaries: Record<Locale, Dictionary> = {
  en,
  ru,
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (savedLocale === 'en' || savedLocale === 'ru') {
      setLocale(savedLocale)
      return
    }

    const telegramLang = getTelegramWebApp()?.initDataUnsafe.user?.language_code
    const browserLang = window.navigator.language
    const detectedLocale = toSupportedLocale(telegramLang ?? browserLang)
    setLocale(detectedLocale)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string>) => {
      const template = getByPath(dictionaries[locale], key)
      if (!template) {
        return key
      }

      if (!params) {
        return template
      }

      return Object.entries(params).reduce((message, [paramKey, paramValue]) => {
        return message.replaceAll(`{{${paramKey}}}`, paramValue)
      }, template)
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}

function toSupportedLocale(value: string | undefined): Locale {
  if (!value) {
    return 'en'
  }

  const normalizedValue = value.toLowerCase()
  if (normalizedValue.startsWith('ru')) {
    return 'ru'
  }

  return 'en'
}

function getByPath(dictionary: Dictionary, path: string): string | null {
  const chunks = path.split('.')
  let currentValue: unknown = dictionary

  for (const chunk of chunks) {
    if (!currentValue || typeof currentValue !== 'object' || !(chunk in currentValue)) {
      return null
    }

    currentValue = (currentValue as Record<string, unknown>)[chunk]
  }

  return typeof currentValue === 'string' ? currentValue : null
}
