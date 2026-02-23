export interface StartPayload {
  flow?: string
  ref?: string
  campaign?: string
  entityId?: string
  ts: number
}

export interface ParseStartPayloadResult {
  payload?: StartPayload
  error?: string
}

const SAFE_VALUE_REGEX = /^[A-Za-z0-9._:-]{1,128}$/

export function parseStartPayload(rawPayload: string | undefined, ttlSeconds: number): ParseStartPayloadResult {
  if (!rawPayload) {
    return {
      payload: {
        ts: Math.floor(Date.now() / 1000),
      },
    }
  }

  const parsedSearchParams = parsePayloadToSearchParams(rawPayload)
  if (!parsedSearchParams) {
    return {
      error: 'Payload is not a valid query string or base64url-encoded query string',
    }
  }

  const allowedKeys = new Set(['flow', 'ref', 'campaign', 'entityId', 'ts'])
  for (const key of parsedSearchParams.keys()) {
    if (!allowedKeys.has(key)) {
      return { error: `Unsupported payload key: ${key}` }
    }
  }

  const tsRaw = parsedSearchParams.get('ts')
  if (!tsRaw) {
    return { error: 'Payload must contain ts' }
  }

  const ts = Number.parseInt(tsRaw, 10)
  if (!Number.isInteger(ts) || ts <= 0) {
    return { error: 'Payload ts must be a positive integer' }
  }

  const now = Math.floor(Date.now() / 1000)
  if (now - ts > ttlSeconds) {
    return {
      error: `Payload expired (older than ${ttlSeconds}s)`,
    }
  }

  const flow = validateOptionalValue('flow', parsedSearchParams.get('flow'))
  if (flow.error) {
    return { error: flow.error }
  }

  const ref = validateOptionalValue('ref', parsedSearchParams.get('ref'))
  if (ref.error) {
    return { error: ref.error }
  }

  const campaign = validateOptionalValue('campaign', parsedSearchParams.get('campaign'))
  if (campaign.error) {
    return { error: campaign.error }
  }

  const entityId = validateOptionalValue('entityId', parsedSearchParams.get('entityId'))
  if (entityId.error) {
    return { error: entityId.error }
  }

  return {
    payload: {
      flow: flow.value,
      ref: ref.value,
      campaign: campaign.value,
      entityId: entityId.value,
      ts,
    },
  }
}

export function generateStartPayload(input: Omit<StartPayload, 'ts'> & { ts?: number }): string {
  const ts = input.ts ?? Math.floor(Date.now() / 1000)
  const params = new URLSearchParams()

  if (input.flow) {
    params.set('flow', input.flow)
  }
  if (input.ref) {
    params.set('ref', input.ref)
  }
  if (input.campaign) {
    params.set('campaign', input.campaign)
  }
  if (input.entityId) {
    params.set('entityId', input.entityId)
  }

  params.set('ts', String(ts))
  return params.toString()
}

export function buildMiniAppUrl(baseUrl: string, payload?: StartPayload): string {
  const url = new URL(baseUrl)

  if (!payload) {
    return url.toString()
  }

  if (payload.flow) {
    url.searchParams.set('flow', payload.flow)
  }
  if (payload.ref) {
    url.searchParams.set('ref', payload.ref)
  }
  if (payload.campaign) {
    url.searchParams.set('campaign', payload.campaign)
  }
  if (payload.entityId) {
    url.searchParams.set('entityId', payload.entityId)
  }
  url.searchParams.set('ts', String(payload.ts))

  return url.toString()
}

export function buildStartAppDeepLink(
  botUsername: string,
  miniAppShortName: string | undefined,
  payload: string,
): string | undefined {
  if (!miniAppShortName?.trim()) {
    return undefined
  }

  const encodedPayload = encodeURIComponent(payload)
  return `https://t.me/${botUsername}/${miniAppShortName}?startapp=${encodedPayload}`
}

function parsePayloadToSearchParams(rawPayload: string): URLSearchParams | undefined {
  const directCandidate = safelyDecodeURIComponent(rawPayload)
  if (looksLikeQueryString(directCandidate)) {
    return new URLSearchParams(directCandidate)
  }

  const base64urlCandidate = decodeBase64UrlToUtf8(rawPayload)
  if (base64urlCandidate && looksLikeQueryString(base64urlCandidate)) {
    return new URLSearchParams(base64urlCandidate)
  }

  return undefined
}

function looksLikeQueryString(value: string): boolean {
  return value.includes('=')
}

function validateOptionalValue(
  key: string,
  value: string | null,
): {
  value?: string
  error?: string
} {
  if (!value) {
    return {}
  }

  if (!SAFE_VALUE_REGEX.test(value)) {
    return {
      error: `Payload field "${key}" has unsupported characters or length`,
    }
  }

  return { value }
}

function safelyDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeBase64UrlToUtf8(value: string): string | undefined {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return undefined
  }
}
