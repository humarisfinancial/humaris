import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { postgresSearchProvider } from '@/lib/search'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await requireSession()

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json({ error: 'q is required' }, { status: 400 })
    }

    if (q.trim().length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    if (!session.org) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    const truncatedQuery = q.trim().slice(0, 100)
    const results = await postgresSearchProvider.search(truncatedQuery, session.org.id)

    return NextResponse.json({
      results,
      query: truncatedQuery,
      total: results.length,
    })
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
