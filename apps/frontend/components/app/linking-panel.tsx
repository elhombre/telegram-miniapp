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
  getLinkProvidersEndpoint,
  getLinkStartEndpoint,
  getLinkTelegramStartEndpoint,
  getLinkTelegramStatusEndpoint,
} from '@/lib/api'
import { type AuthProvider, parseApiError, readStoredAccessToken, readStoredAuthProvider } from '@/lib/auth-client'
import { GOOGLE_CLIENT_ID, loadGoogleIdentityScript, renderGoogleSignInButton } from '@/lib/google-identity'
import { TELEGRAM_BOT_PUBLIC_NAME } from '@/lib/telegram-login-widget'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'
import { useTheme } from 'next-themes'
import { useI18n } from './i18n-provider'

type LinkProvider = 'email' | 'google' | 'telegram'
type LinkStatus = 'idle' | 'loading' | 'success' | 'error'
type TelegramLinkStatus = 'idle' | 'pending' | 'linked' | 'expired' | 'invalid'

interface LinkStartResponse {
  linkToken: string
  expiresAt: string
}

interface LinkProvidersResponse {
  linkedProviders?: LinkProvider[]
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

interface TelegramLinkStatusResponse {
  status: TelegramLinkStatus
}

interface LinkingPanelProps {
  onProvidersChanged?: () => void | Promise<void>
}

export function LinkingPanel({ onProvidersChanged }: LinkingPanelProps) {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  const { isInTelegram } = useTelegramMiniApp()
  const [currentAuthProvider, setCurrentAuthProvider] = useState<AuthProvider | null>(null)
  const [linkedProviders, setLinkedProviders] = useState<LinkProvider[]>([])

  const [linkProvider, setLinkProvider] = useState<LinkProvider>('email')
  const [linkToken, setLinkToken] = useState('')
  const [linkTokenExpiresAt, setLinkTokenExpiresAt] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkEmailCode, setLinkEmailCode] = useState('')

  const [status, setStatus] = useState<LinkStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [googleReady, setGoogleReady] = useState(false)
  const [selectedGoogleIdToken, setSelectedGoogleIdToken] = useState('')
  const [selectedGoogleAccountLabel, setSelectedGoogleAccountLabel] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<TelegramLinkStatus>('idle')

  const googleButtonRef = useRef<HTMLDivElement | null>(null)

  const notifyProvidersChanged = useCallback(async () => {
    if (!onProvidersChanged) {
      return
    }

    try {
      await onProvidersChanged()
    } catch {
      // Parent refresh should not break linking flow.
    }
  }, [onProvidersChanged])

  const navigateToProfileAfterLink = useCallback(() => {
    router.replace('/dashboard')
    router.refresh()
  }, [router])

  useEffect(() => {
    setCurrentAuthProvider(readStoredAuthProvider())
  }, [])

  const loadLinkedProviders = useCallback(async () => {
    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setLinkedProviders([])
      return
    }

    try {
      const response = await fetch(getLinkProvidersEndpoint(), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as LinkProvidersResponse
      const providers = payload.linkedProviders ?? []
      setLinkedProviders(providers)
    } catch {
      // Do not block the UI if this call fails.
    }
  }, [])

  useEffect(() => {
    void loadLinkedProviders()
  }, [loadLinkedProviders])

  useEffect(() => {
    if (!searchParams) {
      return
    }

    if (searchParams.get('link_provider') !== 'email') {
      const requestedProvider = searchParams.get('link')
      if (
        requestedProvider === 'email' ||
        requestedProvider === 'google' ||
        requestedProvider === 'telegram'
      ) {
        setLinkProvider(requestedProvider)
      }
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

  const availableProviders = useMemo(
    () => getAvailableLinkProviders(currentAuthProvider, linkedProviders),
    [currentAuthProvider, linkedProviders],
  )

  useEffect(() => {
    if (availableProviders.length > 0 && !availableProviders.includes(linkProvider)) {
      const nextProvider = availableProviders[0]
      if (nextProvider) {
        setLinkProvider(nextProvider)
      }
    }
  }, [availableProviders, linkProvider])

  useEffect(() => {
    if (linkProvider === 'google') {
      return
    }

    setSelectedGoogleIdToken('')
    setSelectedGoogleAccountLabel('')
  }, [linkProvider])

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

  const checkTelegramStatus = useCallback(async (rawLinkToken: string) => {
    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setTelegramStatus('invalid')
      return
    }

    try {
      const response = await fetch(getLinkTelegramStatusEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          linkToken: rawLinkToken,
        }),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      const payload = (await response.json()) as TelegramLinkStatusResponse
      setTelegramStatus(payload.status)

      if (payload.status === 'linked') {
        setStatus('success')
        setMessage(t('linking.telegramLinked'))
        setError(null)
        await loadLinkedProviders()
        await notifyProvidersChanged()
        navigateToProfileAfterLink()
      } else if (payload.status === 'expired') {
        setStatus('error')
        setError(t('linking.telegramExpired'))
      } else if (payload.status === 'invalid') {
        setStatus('error')
        setError(t('linking.telegramInvalid'))
      }
    } catch (statusError) {
      const statusErrorMessage = statusError instanceof Error ? statusError.message : String(statusError)
      setStatus('error')
      setError(statusErrorMessage)
    }
  }, [loadLinkedProviders, navigateToProfileAfterLink, notifyProvidersChanged, t])

  useEffect(() => {
    if (!linkToken || telegramStatus !== 'pending') {
      return
    }

    const timerId = window.setInterval(() => {
      void checkTelegramStatus(linkToken)
    }, 2_000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [checkTelegramStatus, linkToken, telegramStatus])

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

  const startTelegramLink = useCallback(async () => {
    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setStatus('error')
      setError('Access token is required')
      setMessage(null)
      return
    }

    setStatus('loading')
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(getLinkTelegramStartEndpoint(), {
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

      const startPayload = buildTelegramStartPayload({
        linkToken: payload.linkToken,
      })
      const startUrl = buildTelegramStartUrl(TELEGRAM_BOT_PUBLIC_NAME, startPayload)

      if (!startUrl) {
        throw new Error('NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME must be a valid bot username')
      }

      setTelegramStatus('pending')
      setStatus('success')
      setMessage(t('linking.telegramOpenPrompt'))

      if (typeof window !== 'undefined') {
        window.open(startUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (startError) {
      const startErrorMessage = startError instanceof Error ? startError.message : String(startError)
      setStatus('error')
      setError(startErrorMessage)
      setMessage(null)
      setTelegramStatus('idle')
    }
  }, [t])

  const confirmLink = useCallback(
    async (options?: { googleIdToken?: string }) => {
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
          await loadLinkedProviders()
          await notifyProvidersChanged()
          navigateToProfileAfterLink()
          return
        }

        const idToken = options?.googleIdToken?.trim()
        if (!idToken) {
          throw new Error(t('linking.googleSelectFirst'))
        }

        const response = await fetch(getLinkConfirmEndpoint(), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            linkToken: ensuredToken,
            provider: 'google',
            idToken,
          }),
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        const payload = (await response.json()) as LinkConfirmResponse
        setStatus('success')
        setMessage(t('linking.linked', { provider: payload.provider }))
        await loadLinkedProviders()
        await notifyProvidersChanged()
        navigateToProfileAfterLink()
      } catch (linkError) {
        const linkMessage = linkError instanceof Error ? linkError.message : String(linkError)
        setStatus('error')
        setError(linkMessage)
        setMessage(null)
      }
    },
    [
      ensureLinkToken,
      linkEmail,
      linkEmailCode,
      linkProvider,
      loadLinkedProviders,
      navigateToProfileAfterLink,
      notifyProvidersChanged,
      t,
    ],
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
        const claimsPayload = decodeJwtPayloadObject(credential)
        const accountLabel = getGoogleAccountLabel(claimsPayload, t('auth.googleSelectedFallback'))
        setSelectedGoogleIdToken(credential)
        setSelectedGoogleAccountLabel(accountLabel)
        setStatus('idle')
        setError(null)
        setMessage(null)
      }, {
        theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
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
  }, [isInTelegram, linkProvider, resolvedTheme, t])

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
                  <div ref={googleButtonRef} className="google-signin-container min-h-10" />
                  {GOOGLE_CLIENT_ID && !googleReady ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  ) : null}
                  {selectedGoogleAccountLabel ? (
                    <p className="text-sm text-muted-foreground">
                      {t('linking.selectedGoogle', { account: selectedGoogleAccountLabel })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {linkProvider === 'telegram' ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Telegram</Label>
                  <p className="text-sm text-muted-foreground">{t('linking.telegramStartHint')}</p>
                  {telegramStatus === 'pending' ? (
                    <p className="text-sm text-muted-foreground">{t('linking.telegramAwaiting')}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{t('linking.telegramHint')}</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {linkProvider === 'email' ? (
                <>
                  <Button className="min-h-11" onClick={() => void requestEmailCode()} disabled={status === 'loading'}>
                    {t('linking.sendCode')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => void confirmLink()}
                    disabled={status === 'loading'}
                  >
                    {t('linking.confirmCode')}
                  </Button>
                </>
              ) : null}

              {linkProvider === 'google' ? (
                <Button
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void confirmLink({ googleIdToken: selectedGoogleIdToken })}
                  disabled={status === 'loading' || !selectedGoogleIdToken}
                >
                  {t('linking.confirmGoogle')}
                </Button>
              ) : null}

              {linkProvider === 'telegram' ? (
                <Button
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void startTelegramLink()}
                  disabled={status === 'loading'}
                >
                  {t('linking.telegramStartButton')}
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="min-h-11"
                disabled={status === 'loading'}
                onClick={() => {
                  setLinkEmail('')
                  setLinkEmailCode('')
                  setError(null)
                  setMessage(null)
                  setStatus('idle')
                  setSelectedGoogleIdToken('')
                  setSelectedGoogleAccountLabel('')
                  setTelegramStatus('idle')
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

function getAvailableLinkProviders(
  currentProvider: AuthProvider | null,
  linkedProviders: LinkProvider[],
): LinkProvider[] {
  if (!currentProvider) {
    return []
  }

  const alreadyLinked = new Set(linkedProviders)

  let candidates: LinkProvider[] = []
  if (currentProvider === 'google') {
    candidates = ['email', 'telegram']
  } else if (currentProvider === 'email') {
    candidates = ['google', 'telegram']
  } else {
    candidates = ['email', 'google']
  }

  return candidates.filter(provider => !alreadyLinked.has(provider))
}

function decodeJwtPayloadObject(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.')
  if (parts.length < 2) {
    return null
  }

  try {
    const payloadSegment = parts[1]
    if (!payloadSegment) {
      return null
    }

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = window.atob(padded)
    const payload = JSON.parse(decoded) as unknown

    if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
      return null
    }

    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

function getGoogleAccountLabel(payload: Record<string, unknown> | null, fallback: string): string {
  if (!payload) {
    return fallback
  }

  const email = payload.email
  if (typeof email === 'string' && email.trim()) {
    return email.trim()
  }

  const name = payload.name
  if (typeof name === 'string' && name.trim()) {
    return name.trim()
  }

  return fallback
}

function buildTelegramStartPayload(input: { linkToken: string }): string {
  return `l_${input.linkToken}`
}

function buildTelegramStartUrl(rawBotPublicName: string, payload: string): string | null {
  const botUsername = normalizeBotUsername(rawBotPublicName)
  if (!botUsername) {
    return null
  }

  return `https://t.me/${botUsername}?start=${encodeURIComponent(payload)}`
}

function normalizeBotUsername(rawValue: string): string | null {
  const value = rawValue.trim().replace(/^@/, '')
  if (!value) {
    return null
  }

  if (!/^[a-zA-Z0-9_]{5,}$/.test(value)) {
    return null
  }

  return value
}
