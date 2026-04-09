import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { DuplicateRepository } from '@/lib/db/repositories/duplicate-repository'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import type { DuplicateResolution } from '@/types'

export async function GET() {
  try {
    const session = await requireSession()
    const pending = await DuplicateRepository.listPending(session.org.id)
    return NextResponse.json({ items: pending, total: pending.length })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list duplicates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.documents.resolveDuplicate(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { flag_id, resolution } = (await request.json()) as {
      flag_id: string
      resolution: DuplicateResolution
    }

    const flag = await DuplicateRepository.resolve(
      flag_id,
      session.org.id,
      resolution,
      session.id
    )

    // Apply resolution side effects
    if (resolution === 'keep_existing') {
      // Remove the newly uploaded file from the library
      await DocumentRepository.delete(flag.doc_id, session.org.id)
    } else if (resolution === 'keep_new') {
      // Replace existing with new — delete old from review folder, move new to correct folder
      const doc = await DocumentRepository.findById(flag.doc_id, session.org.id)
      if (doc?.metadata?.original_folder) {
        await DocumentRepository.update(flag.doc_id, session.org.id, {
          folder: doc.metadata.original_folder as never,
          is_duplicate: false,
        })
        if (flag.matched_doc_id) {
          await DocumentRepository.delete(flag.matched_doc_id, session.org.id)
        }
      }
    } else if (resolution === 'keep_both') {
      // Move both out of duplicates_review; add (v2) suffix to new one
      const doc = await DocumentRepository.findById(flag.doc_id, session.org.id)
      if (doc) {
        const renamedName = doc.renamed_name ?? doc.original_name
        const ext = renamedName.match(/\.\w+$/)?.[0] ?? ''
        const base = renamedName.replace(/\.\w+$/, '')
        await DocumentRepository.update(flag.doc_id, session.org.id, {
          folder: (doc.metadata?.original_folder as never) ?? 'other',
          renamed_name: `${base} (v2)${ext}`,
          is_duplicate: false,
        })
      }
    } else if (resolution === 'decide_later') {
      // Already in duplicates_review — just mark flag resolved for now
      // Document stays in the folder
    }

    return NextResponse.json({ flag })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to resolve duplicate' }, { status: 500 })
  }
}
