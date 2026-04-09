import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.extraction.review(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const record = await ExtractionRepository.findById(id, session.org.id)
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await ExtractionRepository.update(id, session.org.id, {
      status: 'rejected',
      reviewed_by: session.id,
      reviewed_at: new Date().toISOString(),
    })

    // Reset document status back to pending so it can be re-processed
    await DocumentRepository.update(record.document_id, session.org.id, { status: 'pending' })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to reject' }, { status: 500 })
  }
}
