import { proxyAuthGet } from '../../_shared/proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return proxyAuthGet(request, 'link/providers', { forwardAuthorizationHeader: true })
}
