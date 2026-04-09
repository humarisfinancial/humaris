import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params
    const record = await ExtractionRepository.findById(id, session.org.id)
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(record)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch extraction record' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.extraction.edit(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const record = await ExtractionRepository.update(id, session.org.id, body)
    return NextResponse.json(record)
  } catch {
    return NextResponse.json({ error: 'Failed to update extraction record' }, { status: 500 })
  }
}
