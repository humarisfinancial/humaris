import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await requireSession()
    const { documentId } = await params
    const record = await ExtractionRepository.findByDocumentId(documentId, session.org.id)
    if (!record) return NextResponse.json(null)
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch extraction' },
      { status: 500 }
    )
  }
}
