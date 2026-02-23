export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    role: string
    email: string | null
  }
}

export type AuthProvider = 'telegram' | 'google' | 'email'

export interface ApiErrorResponse {
  code?: string
  message?: string
}

const STORAGE_KEYS = {
  accessToken: 'miniapp.accessToken',
  refreshToken: 'miniapp.refreshToken',
  session: 'miniapp.session',
  authProvider: 'miniapp.authProvider',
} as const

export function persistAuthSession(payload: AuthResponse) {
  if (typeof window === 'undefined') {
    return
  }

  sessionStorage.setItem(STORAGE_KEYS.accessToken, payload.accessToken)
  sessionStorage.setItem(STORAGE_KEYS.refreshToken, payload.refreshToken)
  sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(payload))
}

export function readStoredSession(): AuthResponse | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawSession = sessionStorage.getItem(STORAGE_KEYS.session)
  if (!rawSession) {
    return null
  }

  try {
    const payload = JSON.parse(rawSession) as AuthResponse
    if (!payload?.accessToken || !payload?.refreshToken || !payload?.user?.id || !payload?.user?.role) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export function readStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return sessionStorage.getItem(STORAGE_KEYS.refreshToken)
}

export function persistAuthProvider(provider: AuthProvider) {
  if (typeof window === 'undefined') {
    return
  }

  sessionStorage.setItem(STORAGE_KEYS.authProvider, provider)
}

export function readStoredAuthProvider(): AuthProvider | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = sessionStorage.getItem(STORAGE_KEYS.authProvider)
  if (value === 'telegram' || value === 'google' || value === 'email') {
    return value
  }

  return null
}

export function readStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return sessionStorage.getItem(STORAGE_KEYS.accessToken)
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return
  }

  sessionStorage.removeItem(STORAGE_KEYS.accessToken)
  sessionStorage.removeItem(STORAGE_KEYS.refreshToken)
  sessionStorage.removeItem(STORAGE_KEYS.session)
  sessionStorage.removeItem(STORAGE_KEYS.authProvider)
}

export async function parseApiError(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`
  const contentType = response.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as ApiErrorResponse
      return payload.message || payload.code || fallback
    }

    const text = await response.text()
    return text || fallback
  } catch {
    return fallback
  }
}

export function maskToken(value: string): string {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`
}
