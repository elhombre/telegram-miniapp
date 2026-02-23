'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  getLinkConfirmEndpoint,
  getLinkEmailConfirmEndpoint,
  getLinkEmailRequestEndpoint,
  getLinkStartEndpoint,
} from '@/lib/api'
import { type AuthProvider, parseApiError, readStoredAccessToken, readStoredAuthProvider } from '@/lib/auth-client'
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, renderGoogleSignInButton } from '@/lib/google-identity'
import {
  TELEGRAM_BOT_PUBLIC_NAME,
  buildTelegramLoginWidgetAuthDataRaw,
  renderTelegramLoginWidget,
} from '@/lib/telegram-login-widget'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'
import { useI18n } from './i18n-provider'

type LinkProvider = 'email' | 'google' | 'telegram'
type LinkStatus = 'idle' | 'loading' | 'success' | 'error'

interface LinkStartResponse {
  linkToken: string
  expiresAt: string
}

interface LinkEmailRequestResponse {
  sent: boolean
  provider: 'email'
  email: string
  expiresAt: string
}

interface LinkConfirmResponse {
  linked: boolean
  provider: LinkProvider
}

export function LinkingPanel() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()

  const { isInTelegram } = useTelegramMiniApp()
  const [currentAuthProvider, setCurrentAuthProvider] = useState<AuthProvider | null>(null)

  const [linkProvider, setLinkProvider] = useState<LinkProvider>('email')
  const [linkToken, setLinkToken] = useState('')
  const [linkTokenExpiresAt, setLinkTokenExpiresAt] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkEmailCode, setLinkEmailCode] = useState('')

  const [status, setStatus] = useState<LinkStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [googleReady, setGoogleReady] = useState(false)
  const [telegramReady, setTelegramReady] = useState(false)

  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const telegramButtonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setCurrentAuthProvider(readStoredAuthProvider())
  }, [])

  useEffect(() => {
    if (!searchParams) {
      return
    }

    if (searchParams.get('link_provider') !== 'email') {
      return
    }

    const prefilledEmail = searchParams.get('link_email')?.trim() ?? ''
    const prefilledCode = searchParams.get('link_code')?.trim() ?? ''
    const prefilledLinkToken = searchParams.get('link_token')?.trim() ?? ''

    if (prefilledEmail) {
      setLinkEmail(prefilledEmail)
    }

    if (prefilledCode) {
      setLinkEmailCode(prefilledCode)
    }

    if (prefilledLinkToken) {
      setLinkToken(prefilledLinkToken)
      setLinkTokenExpiresAt(null)
    }

    setLinkProvider('email')

    if (prefilledEmail || prefilledCode) {
      setMessage(t('linking.emailSent', { email: prefilledEmail || '***' }))
    }

    router.replace('/dashboard/linking')
  }, [router, searchParams, t])

  const availableProviders = useMemo(() => getAvailableLinkProviders(currentAuthProvider), [currentAuthProvider])

  useEffect(() => {
    if (availableProviders.length > 0 && !availableProviders.includes(linkProvider)) {
      const nextProvider = availableProviders[0]
      if (nextProvider) {
        setLinkProvider(nextProvider)
      }
    }
  }, [availableProviders, linkProvider])

  const ensureLinkToken = useCallback(
    async (accessToken: string): Promise<string | null> => {
      const expiresAtTs = linkTokenExpiresAt ? Date.parse(linkTokenExpiresAt) : Number.NaN
      const hasUsableToken =
        Boolean(linkToken.trim()) && Number.isFinite(expiresAtTs) && expiresAtTs - Date.now() > 15_000

      if (hasUsableToken) {
        return linkToken.trim()
      }

      try {
        const response = await fetch(getLinkStartEndpoint(), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: '{}',
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        const payload = (await response.json()) as LinkStartResponse
        setLinkToken(payload.linkToken)
        setLinkTokenExpiresAt(payload.expiresAt)
        return payload.linkToken
      } catch (fetchError) {
        const fetchMessage = fetchError instanceof Error ? fetchError.message : String(fetchError)
        setStatus('error')
        setError(fetchMessage)
        setMessage(null)
        return null
      }
    },
    [linkToken, linkTokenExpiresAt],
  )

  const requestEmailCode = useCallback(async () => {
    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setStatus('error')
      setError('Access token is required')
      setMessage(null)
      return
    }

    const ensuredToken = await ensureLinkToken(accessToken)
    if (!ensuredToken) {
      return
    }

    const trimmedEmail = linkEmail.trim()
    if (!trimmedEmail) {
      setStatus('error')
      setError('Email is required')
      setMessage(null)
      return
    }

    setStatus('loading')
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(getLinkEmailRequestEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          linkToken: ensuredToken,
          email: trimmedEmail,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as LinkEmailRequestResponse
      setStatus('success')
      setLinkTokenExpiresAt(payload.expiresAt)
      setMessage(t('linking.emailSent', { email: payload.email }))
    } catch (requestError) {
      const requestMessage = requestError instanceof Error ? requestError.message : String(requestError)
      setStatus('error')
      setError(requestMessage)
      setMessage(null)
    }
  }, [ensureLinkToken, linkEmail, t])

  const confirmLink = useCallback(
    async (options?: { googleIdToken?: string; telegramAuthDataRaw?: string }) => {
      const accessToken = readStoredAccessToken()
      if (!accessToken) {
        setStatus('error')
        setError('Access token is required')
        setMessage(null)
        return
      }

      const ensuredToken = await ensureLinkToken(accessToken)
      if (!ensuredToken) {
        return
      }

      setStatus('loading')
      setError(null)
      setMessage(null)

      try {
        if (linkProvider === 'email') {
          const response = await fetch(getLinkEmailConfirmEndpoint(), {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              linkToken: ensuredToken,
              email: linkEmail.trim(),
              code: linkEmailCode.trim(),
            }),
          })

          if (!response.ok) {
            throw new Error(await parseApiError(response))
          }

          const payload = (await response.json()) as LinkConfirmResponse
          setStatus('success')
          setMessage(t('linking.linked', { provider: payload.provider }))
          return
        }

        const requestBody: {
          linkToken: string
          provider: 'google' | 'telegram'
          idToken?: string
          initDataRaw?: string
        } = {
          linkToken: ensuredToken,
          provider: linkProvider === 'google' ? 'google' : 'telegram',
        }

        if (linkProvider === 'google') {
          const idToken = options?.googleIdToken?.trim()
          if (!idToken) {
            throw new Error(t('linking.googleButton'))
          }
          requestBody.idToken = idToken
        }

        if (linkProvider === 'telegram') {
          const initDataRaw = options?.telegramAuthDataRaw?.trim()
          if (!initDataRaw) {
            throw new Error(t('linking.telegramButton'))
          }

          requestBody.initDataRaw = initDataRaw
        }

        const response = await fetch(getLinkConfirmEndpoint(), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        const payload = (await response.json()) as LinkConfirmResponse
        setStatus('success')
        setMessage(t('linking.linked', { provider: payload.provider }))
      } catch (linkError) {
        const linkMessage = linkError instanceof Error ? linkError.message : String(linkError)
        setStatus('error')
        setError(linkMessage)
        setMessage(null)
      }
    },
    [ensureLinkToken, linkEmail, linkEmailCode, linkProvider, t],
  )

  useEffect(() => {
    if (linkProvider !== 'google' || isInTelegram !== false || !GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      setGoogleReady(false)
      return
    }

    let cancelled = false

    const initialize = async () => {
      try {
        await loadGoogleIdentityScript()
      } catch (loadError) {
        if (!cancelled) {
          const loadMessage = loadError instanceof Error ? loadError.message : String(loadError)
          setError(loadMessage)
        }
        return
      }

      if (cancelled || !googleButtonRef.current) {
        return
      }

      renderGoogleSignInButton(googleButtonRef.current, credential => {
        void confirmLink({ googleIdToken: credential })
      })

      setGoogleReady(true)
    }

    void initialize()

    return () => {
      cancelled = true
      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = ''
      }
    }
  }, [confirmLink, isInTelegram, linkProvider])

  useEffect(() => {
    if (linkProvider !== 'telegram' || isInTelegram !== false || !TELEGRAM_BOT_PUBLIC_NAME || !telegramButtonRef.current) {
      setTelegramReady(false)
      return
    }

    let cleanup: (() => void) | undefined

    try {
      cleanup = renderTelegramLoginWidget(telegramButtonRef.current, user => {
        const authDataRaw = buildTelegramLoginWidgetAuthDataRaw(user)
        void confirmLink({ telegramAuthDataRaw: authDataRaw })
      })
      setTelegramReady(true)
    } catch (widgetError) {
      const widgetMessage = widgetError instanceof Error ? widgetError.message : String(widgetError)
      setError(widgetMessage)
      setTelegramReady(false)
      return
    }

    return () => {
      cleanup?.()
      if (telegramButtonRef.current) {
        telegramButtonRef.current.innerHTML = ''
      }
    }
  }, [confirmLink, isInTelegram, linkProvider])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('linking.title')}</CardTitle>
        <CardDescription>{t('linking.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isInTelegram === true ? <p className="text-sm text-muted-foreground">{t('linking.browserOnly')}</p> : null}
        {!currentAuthProvider ? <p className="text-sm text-muted-foreground">{t('linking.needProvider')}</p> : null}

        {isInTelegram === false && currentAuthProvider && availableProviders.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('linking.provider')}</Label>
                <Select value={linkProvider} onValueChange={value => setLinkProvider(value as LinkProvider)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('linking.provider')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map(providerOption => (
                      <SelectItem key={providerOption} value={providerOption}>
                        {providerOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {linkProvider === 'email' ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('common.email')}</Label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={linkEmail}
                      onChange={event => setLinkEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('linking.emailCode')}</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder={t('linking.emailCodePlaceholder')}
                      value={linkEmailCode}
                      onChange={event => setLinkEmailCode(event.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {linkProvider === 'google' ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Google</Label>
                  <div ref={googleButtonRef} className="min-h-10" />
                  {GOOGLE_CLIENT_ID && !googleReady ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  ) : null}
                </div>
              ) : null}

              {linkProvider === 'telegram' ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Telegram</Label>
                  <div ref={telegramButtonRef} className="min-h-10" />
                  {TELEGRAM_BOT_PUBLIC_NAME && !telegramReady ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{t('linking.telegramHint')}</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {linkProvider === 'email' ? (
                <>
                  <Button onClick={() => void requestEmailCode()} disabled={status === 'loading'}>
                    {t('linking.sendCode')}
                  </Button>
                  <Button variant="secondary" onClick={() => void confirmLink()} disabled={status === 'loading'}>
                    {t('linking.confirmCode')}
                  </Button>
                </>
              ) : null}

              {linkProvider === 'google' ? (
                <Button variant="secondary" disabled>
                  {t('linking.googleButton')}
                </Button>
              ) : null}

              {linkProvider === 'telegram' ? (
                <Button variant="secondary" disabled>
                  {t('linking.telegramButton')}
                </Button>
              ) : null}

              <Button
                variant="outline"
                disabled={status === 'loading'}
                onClick={() => {
                  setLinkEmail('')
                  setLinkEmailCode('')
                  setError(null)
                  setMessage(null)
                  setStatus('idle')
                }}
              >
                {t('linking.reset')}
              </Button>
            </div>
          </>
        ) : null}

        {isInTelegram === false && currentAuthProvider && availableProviders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('linking.noOptions')}</p>
        ) : null}

        {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
        {error ? (
          <p className="text-sm text-destructive">
            {t('common.error')}: {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function getAvailableLinkProviders(currentProvider: AuthProvider | null): LinkProvider[] {
  if (!currentProvider) {
    return []
  }

  if (currentProvider === 'google') {
    return ['email', 'telegram']
  }

  if (currentProvider === 'email') {
    return ['google', 'telegram']
  }

  return ['email', 'google']
}
