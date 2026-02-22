import { proxyNotesRequest } from '../_shared/proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface DeleteNoteRouteContext {
  params: Promise<{ noteId: string }>
}

export async function DELETE(request: Request, context: DeleteNoteRouteContext) {
  const params = await context.params
  return proxyNotesRequest(request, encodeURIComponent(params.noteId), { method: 'DELETE' })
}
