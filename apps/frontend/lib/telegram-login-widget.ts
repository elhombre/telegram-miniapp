export const TELEGRAM_BOT_PUBLIC_NAME = normalizeBotPublicName(process.env.NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME)

const TELEGRAM_WIDGET_SCRIPT_SRC = 'https://telegram.org/js/telegram-widget.js?22'

export interface TelegramLoginWidgetUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export function renderTelegramLoginWidget(
  parent: HTMLElement,
  onAuth: (user: TelegramLoginWidgetUser) => void,
): () => void {
  if (!TELEGRAM_BOT_PUBLIC_NAME) {
    throw new Error('NEXT_PUBLIC_TELEGRAM_BOT_PUBLIC_NAME is not configured')
  }

  parent.innerHTML = ''

  const callbackName = `__telegramAuthCallback_${Math.random().toString(36).slice(2)}`
  ;(window as unknown as Record<string, unknown>)[callbackName] = (user: TelegramLoginWidgetUser) => {
    onAuth(user)
  }

  const script = document.createElement('script')
  script.src = TELEGRAM_WIDGET_SCRIPT_SRC
  script.async = true
  script.setAttribute('data-telegram-login', TELEGRAM_BOT_PUBLIC_NAME)
  script.setAttribute('data-size', 'large')
  script.setAttribute('data-userpic', 'false')
  script.setAttribute('data-request-access', 'write')
  script.setAttribute('data-onauth', `${callbackName}(user)`)

  parent.appendChild(script)

  return () => {
    delete (window as unknown as Record<string, unknown>)[callbackName]
    if (parent.contains(script)) {
      parent.removeChild(script)
    }
  }
}

export function buildTelegramLoginWidgetAuthDataRaw(user: TelegramLoginWidgetUser): string {
  const params = new URLSearchParams()
  params.set('id', String(user.id))
  params.set('auth_date', String(user.auth_date))
  params.set('hash', user.hash)

  if (user.first_name) {
    params.set('first_name', user.first_name)
  }

  if (user.last_name) {
    params.set('last_name', user.last_name)
  }

  if (user.username) {
    params.set('username', user.username)
  }

  if (user.photo_url) {
    params.set('photo_url', user.photo_url)
  }

  return params.toString()
}

function normalizeBotPublicName(rawValue: string | undefined): string {
  const value = rawValue?.trim()
  if (!value) {
    return ''
  }

  return value.replace(/^@/, '')
}
