import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const per_page = parseInt(searchParams.get('per_page') ?? '25')

    const result = await ExtractionRepository.listForReview(session.org.id, { page, per_page })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 })
  }
}
