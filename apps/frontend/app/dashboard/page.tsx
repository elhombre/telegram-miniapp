'use client'

import Link from 'next/link'
import { Chrome, Mail, MessageCircle, ShieldCheck, ShieldX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardShell } from '@/components/app/dashboard-shell'
import { useI18n } from '@/components/app/i18n-provider'
import { LinkingPanel } from '@/components/app/linking-panel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getLinkProvidersEndpoint, getLinkTelegramUnlinkEndpoint } from '@/lib/api'
import {
  type AuthProvider,
  type AuthResponse,
  parseApiError,
  readStoredAccessToken,
  readStoredAuthProvider,
  readStoredSession,
} from '@/lib/auth-client'
import { useTelegramMiniApp } from '@/lib/use-telegram-miniapp'

type LinkProvider = 'email' | 'google' | 'telegram'

interface LinkProvidersResponse {
  linkedProviders?: LinkProvider[]
  providerDetails?: {
    email?: {
      email?: string
    }
    google?: {
      email?: string
      name?: string
    }
    telegram?: {
      username?: string
      firstName?: string
      lastName?: string
    }
  }
}

interface ProviderCardModel {
  provider: LinkProvider
  title: string
  icon: React.ComponentType<{ className?: string }>
  connected: boolean
  lines: string[]
}

export default function DashboardPage() {
  const { t } = useI18n()
  const { isInTelegram } = useTelegramMiniApp()
  const [session, setSession] = useState<AuthResponse | null>(null)
  const [authProvider, setAuthProvider] = useState<AuthProvider | null>(null)
  const [linkedProviders, setLinkedProviders] = useState<LinkProvider[]>([])
  const [providerDetails, setProviderDetails] = useState<LinkProvidersResponse['providerDetails']>({})
  const [unlinkStatus, setUnlinkStatus] = useState<'idle' | 'loading'>('idle')
  const [unlinkMessage, setUnlinkMessage] = useState<string | null>(null)
  const [unlinkError, setUnlinkError] = useState<string | null>(null)

  useEffect(() => {
    setSession(readStoredSession())
    setAuthProvider(readStoredAuthProvider())
  }, [])

  const loadProviders = useCallback(async () => {
    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setLinkedProviders([])
      setProviderDetails({})
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
      setLinkedProviders(payload.linkedProviders ?? [])
      setProviderDetails(payload.providerDetails ?? {})
    } catch {
      setLinkedProviders([])
      setProviderDetails({})
    }
  }, [])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const providerCards = useMemo<ProviderCardModel[]>(() => {
    const connected = new Set(linkedProviders)
    const telegramLines: string[] = []
    const telegramLabel = formatTelegramUserLabel(providerDetails?.telegram)
    if (telegramLabel) {
      telegramLines.push(telegramLabel)
    }
    if (authProvider === 'telegram') {
      telegramLines.push(t('dashboard.currentSessionProvider'))
    }

    const emailLines: string[] = []
    const emailValue = providerDetails?.email?.email ?? session?.user.email ?? undefined
    if (emailValue) {
      emailLines.push(emailValue)
    }

    const googleLines: string[] = []
    const googleName = providerDetails?.google?.name?.trim()
    const googleEmail = providerDetails?.google?.email?.trim()
    if (googleName) {
      googleLines.push(googleName)
    }
    if (googleEmail) {
      googleLines.push(googleEmail)
    }
    if (authProvider === 'google') {
      googleLines.push(t('dashboard.currentSessionProvider'))
    }

    return [
      {
        provider: 'telegram',
        title: 'Telegram',
        icon: MessageCircle,
        connected: connected.has('telegram'),
        lines: telegramLines,
      },
      {
        provider: 'email',
        title: 'Email',
        icon: Mail,
        connected: connected.has('email'),
        lines: emailLines,
      },
      {
        provider: 'google',
        title: 'Google',
        icon: Chrome,
        connected: connected.has('google'),
        lines: googleLines,
      },
    ]
  }, [authProvider, linkedProviders, providerDetails, session?.user.email, t])

  const isWebMode = isInTelegram === false
  const canUnlinkTelegram = isWebMode && linkedProviders.includes('telegram')

  const unlinkTelegram = useCallback(async () => {
    const accessToken = readStoredAccessToken()
    if (!accessToken) {
      setUnlinkError(t('dashboard.needAuth'))
      return
    }

    setUnlinkStatus('loading')
    setUnlinkError(null)
    setUnlinkMessage(null)

    try {
      const response = await fetch(getLinkTelegramUnlinkEndpoint(), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }

      await loadProviders()
      setUnlinkMessage(t('dashboard.telegramUnlinked'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setUnlinkError(message)
    } finally {
      setUnlinkStatus('idle')
    }
  }, [loadProviders, t])

  return (
    <DashboardShell title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}>
      <div className="grid gap-4 lg:grid-cols-3">
        {providerCards.map(card => {
          const Icon = card.icon
          return (
            <Card key={card.provider}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-4 w-4 text-primary" />
                    {card.title}
                  </CardTitle>
                  <Badge variant={card.connected ? 'secondary' : 'outline'}>
                    {card.connected ? t('dashboard.connected') : t('dashboard.notConnected')}
                  </Badge>
                </div>
                {authProvider === card.provider ? (
                  <Badge variant="outline" className="w-fit">
                    {t('dashboard.activeProvider')}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {card.lines.length > 0 ? (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {card.lines.map(line => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                ) : null}

                <Separator />

                {isWebMode ? (
                  <div className="flex flex-wrap gap-2">
                    {card.connected ? (
                      card.provider === 'telegram' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="min-h-11" disabled={!canUnlinkTelegram}>
                              {t('dashboard.unlinkTelegram')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('dashboard.unlinkTelegramConfirmTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('dashboard.unlinkTelegramConfirmDescription')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void unlinkTelegram()}
                                disabled={unlinkStatus === 'loading'}
                              >
                                {unlinkStatus === 'loading'
                                  ? t('common.loading')
                                  : t('dashboard.unlinkTelegramConfirmAction')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null
                    ) : card.provider === 'telegram' ? (
                      <Button size="sm" className="min-h-11" asChild>
                        <Link href="/dashboard?link=telegram#linking-panel">{t('dashboard.connectTelegram')}</Link>
                      </Button>
                    ) : card.provider === 'google' ? (
                      <Button size="sm" className="min-h-11" asChild>
                        <Link href="/dashboard?link=google#linking-panel">{t('dashboard.connectGoogle')}</Link>
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" className="min-h-11" asChild>
                          <Link href="/auth/login?mode=linking">{t('dashboard.goToSignIn')}</Link>
                        </Button>
                        <Button variant="outline" size="sm" className="min-h-11" asChild>
                          <Link href="/auth/register?mode=linking">{t('dashboard.goToRegister')}</Link>
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <CardDescription>{t('dashboard.miniappProfileHint')}</CardDescription>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {unlinkMessage ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{unlinkMessage}</p> : null}
      {unlinkError ? (
        <p className="text-sm text-destructive">
          {t('common.error')}: {unlinkError}
        </p>
      ) : null}

      {isWebMode ? (
        <section id="linking-panel" className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t('linking.title')}</h2>
          </div>
          <LinkingPanel />
        </section>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldX className="h-4 w-4 text-muted-foreground" />
              {t('linking.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>{t('linking.browserOnly')}</CardDescription>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  )
}

function formatTelegramUserLabel(input: {
  username?: string
  firstName?: string
  lastName?: string
} | undefined): string | undefined {
  const username = input?.username?.trim()
  if (username) {
    return `@${username}`
  }

  const firstName = input?.firstName?.trim()
  const lastName = input?.lastName?.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  return fullName || undefined
}
