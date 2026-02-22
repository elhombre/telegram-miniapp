import { proxyAuthPost } from '../../_shared/proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return proxyAuthPost(request, 'telegram/verify-init-data')
}
