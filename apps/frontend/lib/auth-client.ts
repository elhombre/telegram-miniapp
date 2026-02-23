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

  setStorageValue(STORAGE_KEYS.accessToken, payload.accessToken)
  setStorageValue(STORAGE_KEYS.refreshToken, payload.refreshToken)
  setStorageValue(STORAGE_KEYS.session, JSON.stringify(payload))
}

export function readStoredSession(): AuthResponse | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawSession = getStorageValue(STORAGE_KEYS.session)
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

  return getStorageValue(STORAGE_KEYS.refreshToken)
}

export function persistAuthProvider(provider: AuthProvider) {
  if (typeof window === 'undefined') {
    return
  }

  setStorageValue(STORAGE_KEYS.authProvider, provider)
}

export function readStoredAuthProvider(): AuthProvider | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = getStorageValue(STORAGE_KEYS.authProvider)
  if (value === 'telegram' || value === 'google' || value === 'email') {
    return value
  }

  return null
}

export function readStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return getStorageValue(STORAGE_KEYS.accessToken)
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return
  }

  removeStorageValue(STORAGE_KEYS.accessToken)
  removeStorageValue(STORAGE_KEYS.refreshToken)
  removeStorageValue(STORAGE_KEYS.session)
  removeStorageValue(STORAGE_KEYS.authProvider)
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

function setStorageValue(key: string, value: string) {
  for (const storage of getWritableStorages()) {
    try {
      storage.setItem(key, value)
    } catch {
      // Best effort persistence: ignore storage write errors.
    }
  }
}

function getStorageValue(key: string): string | null {
  for (const storage of getReadableStorages()) {
    try {
      const value = storage.getItem(key)
      if (value) {
        return value
      }
    } catch {
      // Ignore storage read errors and fallback to the next storage.
    }
  }

  return null
}

function removeStorageValue(key: string) {
  for (const storage of getWritableStorages()) {
    try {
      storage.removeItem(key)
    } catch {
      // Best effort cleanup: ignore storage remove errors.
    }
  }
}

function getReadableStorages(): Storage[] {
  return [window.sessionStorage, window.localStorage]
}

function getWritableStorages(): Storage[] {
  return [window.sessionStorage, window.localStorage]
}
