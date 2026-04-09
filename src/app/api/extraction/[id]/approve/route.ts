import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { generateRenamedFilename, getFileExtension } from '@/lib/documents/renaming'

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
    if (record.status === 'approved') {
      return NextResponse.json({ error: 'Record already approved' }, { status: 409 })
    }

    // Approve the extraction record
    const approved = await ExtractionRepository.update(id, session.org.id, {
      status: 'approved',
      reviewed_by: session.id,
      reviewed_at: new Date().toISOString(),
    })

    // Update document: mark extracted + update renamed_name with vendor
    const document = await DocumentRepository.findById(record.document_id, session.org.id)
    if (document) {
      const updates: Record<string, unknown> = { status: 'approved' }

      if (record.vendor_name) {
        const ext = getFileExtension(document.original_name)
        updates.renamed_name = generateRenamedFilename({
          date: record.transaction_date ?? new Date(),
          docType: document.doc_type ?? 'other',
          vendor: record.vendor_name,
          extension: ext,
        })
      }

      await DocumentRepository.update(document.id, session.org.id, updates as never)
    }

    return NextResponse.json({ record: approved })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to approve' },
      { status: 500 }
    )
  }
}
