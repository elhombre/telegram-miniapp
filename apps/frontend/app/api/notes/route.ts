import { proxyNotesRequest } from './_shared/proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return proxyNotesRequest(request, '', { method: 'GET' })
}

export async function POST(request: Request) {
  return proxyNotesRequest(request, '', { method: 'POST', includeBody: true })
}
