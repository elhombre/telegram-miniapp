export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ''

const GOOGLE_SDK_SCRIPT_ID = 'google-identity-services-sdk'

export async function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return
  }

  const existingScript = document.getElementById(GOOGLE_SDK_SCRIPT_ID) as HTMLScriptElement | null
  if (!existingScript) {
    await injectGoogleIdentityScript()
  }

  await waitForGoogleObject()
}

export function renderGoogleSignInButton(parent: HTMLElement, onCredential: (credential: string) => void): void {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured')
  }

  const idApi = window.google?.accounts?.id
  if (!idApi) {
    throw new Error('Google Identity Services SDK is unavailable')
  }

  parent.innerHTML = ''
  idApi.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: response => {
      const credential = response.credential?.trim()
      if (!credential) {
        return
      }

      onCredential(credential)
    },
  })

  idApi.renderButton(parent, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
  })
}

async function injectGoogleIdentityScript(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = GOOGLE_SDK_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'))
    document.head.appendChild(script)
  })
}

async function waitForGoogleObject(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 60

    const intervalId = window.setInterval(() => {
      attempts += 1

      if (window.google?.accounts?.id) {
        window.clearInterval(intervalId)
        resolve()
        return
      }

      if (attempts >= maxAttempts) {
        window.clearInterval(intervalId)
        reject(new Error('Google Identity Services SDK is loaded but unavailable'))
      }
    }, 50)
  })
}

declare global {
  interface Window {
    google?: GoogleIdentityWindow
  }
}

interface GoogleIdentityWindow {
  accounts?: {
    id?: {
      initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
      renderButton: (
        parent: HTMLElement,
        options: {
          theme?: 'outline' | 'filled_blue' | 'filled_black'
          size?: 'small' | 'medium' | 'large'
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape?: 'rectangular' | 'pill' | 'circle' | 'square'
        },
      ) => void
    }
  }
}

interface GoogleCredentialResponse {
  credential?: string
}
