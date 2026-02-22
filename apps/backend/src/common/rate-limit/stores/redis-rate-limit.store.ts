import type { RateLimitProvider } from '../../../config/env.schema'
import Redis from 'ioredis'
import type { RateLimitHitResult, RateLimitStore } from '../rate-limit.types'
import { toPositiveInt } from '../rate-limit.utils'

interface RedisRateLimitStoreOptions {
  url: string
  connectTimeoutMs: number
}

export class RedisRateLimitStore implements RateLimitStore {
  readonly provider: RateLimitProvider = 'redis'
  private readonly client: Redis
  private connected = false

  constructor(options: RedisRateLimitStoreOptions) {
    this.client = new Redis(options.url, {
      connectTimeout: options.connectTimeoutMs,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
  }

  async increment(key: string, windowMs: number): Promise<RateLimitHitResult> {
    await this.ensureConnected()

    const results = await this.client.pipeline().incr(key).pttl(key).pexpire(key, windowMs, 'NX').pttl(key).exec()
    if (!results) {
      throw new Error('Redis pipeline returned empty result')
    }

    const incrResult = toPositiveInt(readRedisPipelineResult(results[0]))
    const ttlResult = toPositiveInt(readRedisPipelineResult(results[3]))
    const ttlMs = ttlResult > 0 ? ttlResult : windowMs

    return {
      count: incrResult > 0 ? incrResult : 1,
      resetAtMs: Date.now() + ttlMs,
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit()
    } catch {
      this.client.disconnect()
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return
    }

    await this.client.connect()
    this.connected = true
  }
}

function readRedisPipelineResult(entry: [unknown, unknown] | undefined): unknown {
  if (!entry) {
    throw new Error('Redis pipeline result entry is missing')
  }

  const [error, result] = entry
  if (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }

  return result
}
