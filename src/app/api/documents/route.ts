import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import type { DocumentFolder, DocumentStatus, DocumentType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)

    const folder = searchParams.get('folder') as DocumentFolder | null
    const status = searchParams.get('status') as DocumentStatus | null
    const docType = searchParams.get('doc_type') as DocumentType | null
    const search = searchParams.get('search') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1')
    const per_page = parseInt(searchParams.get('per_page') ?? '50')

    const result = await DocumentRepository.list(
      session.org.id,
      { folder: folder ?? undefined, status: status ?? undefined, doc_type: docType ?? undefined, search },
      { page, per_page }
    )

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list documents' },
      { status: 500 }
    )
  }
}
