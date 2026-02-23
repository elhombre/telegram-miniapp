import { NextResponse } from 'next/server'

const BACKEND_DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1'

export async function proxyAuthPost(request: Request, authPath: string) {
  const backendUrl = resolveBackendAuthUrl(authPath)

  if (!backendUrl) {
    return NextResponse.json(
      {
        code: 'INVALID_BACKEND_API_BASE_URL',
        message: 'Backend API base URL is not configured correctly',
      },
      { status: 500 },
    )
  }

  let requestBodyRaw = ''
  try {
    requestBodyRaw = await request.text()
  } catch {
    return NextResponse.json(
      {
        code: 'INVALID_REQUEST_BODY',
        message: 'Failed to read request body',
      },
      { status: 400 },
    )
  }

  try {
    const upstreamResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: requestBodyRaw,
      cache: 'no-store',
    })

    const responseText = await upstreamResponse.text()
    const responseContentType = upstreamResponse.headers.get('content-type') ?? 'application/json'

    if (responseContentType.includes('application/json')) {
      const payload = responseText.trim() ? safeParseJson(responseText) : {}
      return NextResponse.json(payload, { status: upstreamResponse.status })
    }

    return new NextResponse(responseText, {
      status: upstreamResponse.status,
      headers: {
        'content-type': responseContentType,
      },
    })
  } catch {
    return NextResponse.json(
      {
        code: 'BACKEND_UNAVAILABLE',
        message: 'Cannot reach backend API',
      },
      { status: 502 },
    )
  }
}

function resolveBackendAuthUrl(authPath: string): string | null {
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(authPath)) {
    return null
  }

  const baseUrl = (process.env.BACKEND_API_BASE_URL ?? BACKEND_DEFAULT_API_BASE_URL).trim()
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  try {
    return new URL(`${normalizedBaseUrl}/auth/${authPath}`).toString()
  } catch {
    return null
  }
}

function safeParseJson(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue) as unknown
  } catch {
    return {
      message: rawValue,
    }
  }
}
