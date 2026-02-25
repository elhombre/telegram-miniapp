import { HttpException, HttpStatus, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { getEnv, type RateLimitProvider } from '../../config/env.schema'
import {
  AUTH_GLOBAL_RULES,
  POLICY_RULES,
  type AuthRateLimitPolicy,
  type RateLimitContext,
} from './policies/auth-rate-limit.policies'
import { InMemoryRateLimitStore } from './stores/memory-rate-limit.store'
import type { RateLimitHitResult, RateLimitStore } from './rate-limit.types'
import { RedisRateLimitStore } from './stores/redis-rate-limit.store'

export interface RateLimitAssertInput {
  request: Request
  userId?: string
  email?: string
  refreshToken?: string
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private static readonly REDIS_FALLBACK_RETRY_MS = 30_000
  private static readonly REDIS_CONNECT_TIMEOUT_MS = 2000

  private readonly env = getEnv()
  private readonly logger = new Logger(RateLimitService.name)
  private readonly memoryStore = new InMemoryRateLimitStore()
  private readonly primaryStore: RateLimitStore
  private readonly externalProvider?: Extract<RateLimitProvider, 'redis'>

  private externalBackoffUntilMs = 0
  private externalFallbackLogged = false

  constructor() {
    this.primaryStore = this.createPrimaryStore()

    if (this.primaryStore.provider === 'redis') {
      this.externalProvider = this.primaryStore.provider
      this.logger.log(
        JSON.stringify({
          event: 'rate_limit_store_selected',
          provider: this.primaryStore.provider,
        }),
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.primaryStore.close) {
      await this.primaryStore.close()
    }
  }

  async assert(policy: AuthRateLimitPolicy, input: RateLimitAssertInput): Promise<void> {
    if (!this.env.RATE_LIMIT_ENABLED) {
      return
    }

    const context = this.buildContext(input)
    const rules = [...AUTH_GLOBAL_RULES, ...(POLICY_RULES[policy] ?? [])]
    let retryAfterSeconds = 0

    for (const rule of rules) {
      const keyPart = rule.key(context)
      if (!keyPart) {
        continue
      }

      const cacheKey = `rl:${rule.id}:${keyPart}`
      const hit = await this.increment(cacheKey, rule.windowMs)

      if (hit.count > rule.limit) {
        const secondsUntilReset = Math.max(1, Math.ceil((hit.resetAtMs - Date.now()) / 1000))
        retryAfterSeconds = Math.max(retryAfterSeconds, secondsUntilReset)
      }
    }

    if (retryAfterSeconds > 0) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  private async increment(key: string, windowMs: number): Promise<RateLimitHitResult> {
    if (!this.externalProvider) {
      return this.primaryStore.increment(key, windowMs)
    }

    if (Date.now() < this.externalBackoffUntilMs) {
      return this.memoryStore.increment(key, windowMs)
    }

    try {
      const result = await this.primaryStore.increment(key, windowMs)

      if (this.externalFallbackLogged) {
        this.externalFallbackLogged = false
        this.logger.log(
          JSON.stringify({
            event: 'rate_limit_external_store_restored',
            provider: this.externalProvider,
          }),
        )
      }

      return result
    } catch (error) {
      this.externalBackoffUntilMs = Date.now() + RateLimitService.REDIS_FALLBACK_RETRY_MS

      if (!this.externalFallbackLogged) {
        this.externalFallbackLogged = true
        this.logger.warn(
          JSON.stringify({
            event: 'rate_limit_external_store_unavailable',
            provider: this.externalProvider,
            fallback: 'memory',
            retryInSeconds: Math.ceil(RateLimitService.REDIS_FALLBACK_RETRY_MS / 1000),
            error: error instanceof Error ? error.message : String(error),
          }),
        )
      }

      return this.memoryStore.increment(key, windowMs)
    }
  }

  private createPrimaryStore(): RateLimitStore {
    if (this.env.REDIS_URL) {
      return new RedisRateLimitStore({
        url: this.env.REDIS_URL,
        connectTimeoutMs: RateLimitService.REDIS_CONNECT_TIMEOUT_MS,
      })
    }

    return this.memoryStore
  }

  private buildContext(input: RateLimitAssertInput): RateLimitContext {
    const ip = resolveClientIp(input.request)
    const email = normalizeOptionalEmail(input.email)
    const refreshToken = input.refreshToken?.trim()

    return {
      ip,
      userId: input.userId?.trim() || undefined,
      email,
      refreshTokenHash: refreshToken ? hashValue(refreshToken) : undefined,
    }
  }
}

function resolveClientIp(request: Request): string {
  // Use Express-resolved IP only.
  // This prevents direct trust in client-supplied X-Forwarded-For headers.
  const rawIp = request.ip || request.socket.remoteAddress || 'unknown'

  if (rawIp === '::1') {
    return '127.0.0.1'
  }

  if (rawIp.startsWith('::ffff:')) {
    return rawIp.slice('::ffff:'.length)
  }

  return rawIp
}

function normalizeOptionalEmail(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()
  return normalized ? normalized : undefined
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
