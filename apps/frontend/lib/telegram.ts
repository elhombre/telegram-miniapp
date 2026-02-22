export interface TelegramWebAppUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser
  query_id?: string
  auth_date?: string
  hash?: string
  start_param?: string
}

export interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

export interface TelegramMainButton {
  setText(text: string): TelegramMainButton
  show(): TelegramMainButton
  hide(): TelegramMainButton
  onClick(handler: () => void): TelegramMainButton
  offClick(handler: () => void): TelegramMainButton
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: TelegramWebAppInitDataUnsafe
  platform?: string
  colorScheme?: 'light' | 'dark'
  themeParams: TelegramThemeParams
  ready(): void
  expand(): void
  MainButton: TelegramMainButton
}

interface TelegramGlobal {
  WebApp?: TelegramWebApp
}

declare global {
  interface Window {
    Telegram?: TelegramGlobal
  }
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.Telegram?.WebApp
}

export function applyTelegramTheme(theme: TelegramThemeParams) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement

  setCssVar(root, '--tg-bg-color', theme.bg_color)
  setCssVar(root, '--tg-text-color', theme.text_color)
  setCssVar(root, '--tg-hint-color', theme.hint_color)
  setCssVar(root, '--tg-link-color', theme.link_color)
  setCssVar(root, '--tg-button-color', theme.button_color)
  setCssVar(root, '--tg-button-text-color', theme.button_text_color)
  setCssVar(root, '--tg-secondary-bg-color', theme.secondary_bg_color)
}

function setCssVar(root: HTMLElement, variableName: string, value: string | undefined) {
  if (!value) {
    return
  }

  root.style.setProperty(variableName, value)
}
