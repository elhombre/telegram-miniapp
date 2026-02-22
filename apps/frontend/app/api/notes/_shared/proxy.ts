import { NextResponse } from 'next/server'

const BACKEND_DEFAULT_API_BASE_URL = 'http://localhost:3000/api/v1'

interface ProxyNotesRequestOptions {
  method: 'GET' | 'POST' | 'DELETE'
  includeBody?: boolean
}

export async function proxyNotesRequest(
  request: Request,
  notesPath: string,
  options: ProxyNotesRequestOptions,
) {
  const backendUrl = resolveBackendNotesUrl(notesPath)

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

  if (options.includeBody) {
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
  }

  try {
    const headers: Record<string, string> = {}
    const authorization = request.headers.get('authorization')
    if (authorization) {
      headers.authorization = authorization
    }

    if (options.includeBody) {
      headers['content-type'] = 'application/json'
    }

    const upstreamResponse = await fetch(backendUrl, {
      method: options.method,
      headers,
      body: options.includeBody ? requestBodyRaw : undefined,
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

function resolveBackendNotesUrl(notesPath: string): string | null {
  const normalizedNotesPath = notesPath.trim()
  if (normalizedNotesPath && !/^[a-z0-9-]+(?:\/[a-z0-9-._~%]+)*$/i.test(normalizedNotesPath)) {
    return null
  }

  const baseUrl = (process.env.BACKEND_API_BASE_URL ?? BACKEND_DEFAULT_API_BASE_URL).trim()
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  try {
    const targetPath = normalizedNotesPath ? `/notes/${normalizedNotesPath}` : '/notes'
    return new URL(`${normalizedBaseUrl}${targetPath}`).toString()
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
