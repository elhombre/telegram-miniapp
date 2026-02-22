import type { RateLimitProvider } from '../../config/env.schema'

export interface RateLimitHitResult {
  count: number
  resetAtMs: number
}

export interface RateLimitStore {
  provider: RateLimitProvider
  increment(key: string, windowMs: number): Promise<RateLimitHitResult>
  close?(): Promise<void>
}
