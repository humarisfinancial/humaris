import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { deleteDocument, getSignedUrl } from '@/lib/storage'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params
    const doc = await DocumentRepository.findById(id, session.org.id)

    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const url = await getSignedUrl('financial-documents', doc.storage_path)
    return NextResponse.json({ ...doc, signed_url: url })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.documents.edit(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const doc = await DocumentRepository.update(id, session.org.id, body)
    return NextResponse.json(doc)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.documents.delete(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const doc = await DocumentRepository.findById(id, session.org.id)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await deleteDocument(doc.storage_path)
    await DocumentRepository.delete(id, session.org.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
