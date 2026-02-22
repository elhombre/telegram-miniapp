import type { RateLimitProvider } from '../../../config/env.schema'
import type { RateLimitHitResult, RateLimitStore } from '../rate-limit.types'

export class InMemoryRateLimitStore implements RateLimitStore {
  readonly provider: RateLimitProvider = 'memory'
  private readonly counters = new Map<string, { count: number; resetAtMs: number }>()

  async increment(key: string, windowMs: number): Promise<RateLimitHitResult> {
    const now = Date.now()
    const existing = this.counters.get(key)

    if (!existing || existing.resetAtMs <= now) {
      const fresh = { count: 1, resetAtMs: now + windowMs }
      this.counters.set(key, fresh)
      return { count: fresh.count, resetAtMs: fresh.resetAtMs }
    }

    existing.count += 1
    return { count: existing.count, resetAtMs: existing.resetAtMs }
  }
}
