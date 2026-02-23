'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader } from './site-header'
import type { AuthResponse } from '@/lib/auth-client'
import { clearAuthSession, parseApiError, readStoredRefreshToken } from '@/lib/auth-client'
import { getLogoutEndpoint } from '@/lib/api'

interface AppShellProps {
  session: AuthResponse | null
  children: React.ReactNode
}

export function AppShell({ session, children }: AppShellProps) {
  const router = useRouter()
  const [headerSession, setHeaderSession] = useState<AuthResponse | null>(session)

  useEffect(() => {
    setHeaderSession(session)
  }, [session])

  const logout = useCallback(async () => {
    setHeaderSession(null)
    const refreshToken = readStoredRefreshToken()

    if (refreshToken) {
      try {
        const response = await fetch(getLogoutEndpoint(), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }
      } catch {
        // Best effort logout: local cleanup still continues.
      }
    }

    clearAuthSession()
    router.replace('/')
    router.refresh()
  }, [router])

  return (
    <div className="min-h-screen">
      <SiteHeader session={headerSession} onLogout={headerSession ? logout : undefined} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
