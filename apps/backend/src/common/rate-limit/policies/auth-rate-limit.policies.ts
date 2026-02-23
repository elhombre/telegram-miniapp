export const AUTH_RATE_LIMIT_POLICIES = {
  TELEGRAM_VERIFY_INIT_DATA: 'telegram_verify_init_data',
  EMAIL_REGISTER: 'email_register',
  EMAIL_LOGIN: 'email_login',
  GOOGLE_CALLBACK: 'google_callback',
  REFRESH: 'refresh',
  LOGOUT: 'logout',
  LINK_START: 'link_start',
  LINK_CONFIRM: 'link_confirm',
  LINK_EMAIL_REQUEST: 'link_email_request',
  LINK_EMAIL_CONFIRM: 'link_email_confirm',
} as const

export type AuthRateLimitPolicy = (typeof AUTH_RATE_LIMIT_POLICIES)[keyof typeof AUTH_RATE_LIMIT_POLICIES]

export interface RateLimitContext {
  ip: string
  userId?: string
  email?: string
  refreshTokenHash?: string
}

export interface RateLimitRule {
  id: string
  limit: number
  windowMs: number
  key: (context: RateLimitContext) => string | undefined
}

export const AUTH_GLOBAL_RULES: RateLimitRule[] = [
  {
    id: 'auth_global_ip',
    limit: 120,
    windowMs: 60_000,
    key: context => context.ip,
  },
]

export const POLICY_RULES: Record<AuthRateLimitPolicy, RateLimitRule[]> = {
  telegram_verify_init_data: [
    {
      id: 'telegram_verify_ip',
      limit: 20,
      windowMs: 60_000,
      key: context => context.ip,
    },
  ],
  email_register: [
    {
      id: 'email_register_ip_email',
      limit: 3,
      windowMs: 15 * 60_000,
      key: context => (context.email ? `${context.ip}:${context.email}` : undefined),
    },
    {
      id: 'email_register_ip',
      limit: 10,
      windowMs: 60 * 60_000,
      key: context => context.ip,
    },
  ],
  email_login: [
    {
      id: 'email_login_ip_email',
      limit: 5,
      windowMs: 60_000,
      key: context => (context.email ? `${context.ip}:${context.email}` : undefined),
    },
    {
      id: 'email_login_ip',
      limit: 20,
      windowMs: 15 * 60_000,
      key: context => context.ip,
    },
  ],
  google_callback: [
    {
      id: 'google_callback_ip',
      limit: 10,
      windowMs: 60_000,
      key: context => context.ip,
    },
  ],
  refresh: [
    {
      id: 'refresh_token',
      limit: 30,
      windowMs: 15 * 60_000,
      key: context => context.refreshTokenHash,
    },
    {
      id: 'refresh_ip',
      limit: 60,
      windowMs: 15 * 60_000,
      key: context => context.ip,
    },
  ],
  logout: [
    {
      id: 'logout_ip',
      limit: 60,
      windowMs: 15 * 60_000,
      key: context => context.ip,
    },
  ],
  link_start: [
    {
      id: 'link_start_user',
      limit: 10,
      windowMs: 15 * 60_000,
      key: context => context.userId,
    },
  ],
  link_confirm: [
    {
      id: 'link_confirm_user',
      limit: 10,
      windowMs: 15 * 60_000,
      key: context => context.userId,
    },
  ],
  link_email_request: [
    {
      id: 'link_email_request_user',
      limit: 3,
      windowMs: 15 * 60_000,
      key: context => context.userId,
    },
    {
      id: 'link_email_request_email',
      limit: 3,
      windowMs: 15 * 60_000,
      key: context => context.email,
    },
    {
      id: 'link_email_request_cooldown',
      limit: 1,
      windowMs: 60_000,
      key: context => (context.userId && context.email ? `${context.userId}:${context.email}` : undefined),
    },
  ],
  link_email_confirm: [
    {
      id: 'link_email_confirm_user',
      limit: 6,
      windowMs: 15 * 60_000,
      key: context => context.userId,
    },
    {
      id: 'link_email_confirm_ip',
      limit: 20,
      windowMs: 15 * 60_000,
      key: context => context.ip,
    },
  ],
}
