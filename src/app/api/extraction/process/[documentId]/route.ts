import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { runExtractionPipeline } from '@/lib/extraction/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.extraction.review(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { documentId } = await params
    const document = await DocumentRepository.findById(documentId, session.org.id)

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (document.status === 'processing') {
      return NextResponse.json({ error: 'Document is already being processed' }, { status: 409 })
    }

    const result = await runExtractionPipeline(document, session.org.id)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Extraction process error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}
