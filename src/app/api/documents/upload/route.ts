import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { uploadDocument, uploadOriginal } from '@/lib/storage'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { classifyDocumentType, getFolderForDocType } from '@/lib/documents/classification'
import { generateRenamedFilename, getFileExtension } from '@/lib/documents/renaming'
import { detectDuplicates, computeFileHash } from '@/lib/documents/duplicate-detection'
import { runExtractionPipeline } from '@/lib/extraction/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()

    if (!permissions.documents.upload(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const results = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const extension = getFileExtension(file.name)
      const docType = classifyDocumentType(file.name, file.type)
      const folder = getFolderForDocType(docType)
      const contentHash = computeFileHash(buffer)

      // Detect duplicates before storing
      const duplicates = await detectDuplicates(session.org.id, buffer, file.name)

      // Save the original unmodified file
      const originalUpload = await uploadOriginal(
        session.org.id,
        buffer,
        file.name,
        file.type
      )

      // Generate a placeholder name — will be updated with invoice date + vendor after extraction
      const renamedName = generateRenamedFilename({
        date: new Date(),
        docType,
        extension,
      })

      // Upload the processed copy
      const docUpload = await uploadDocument(
        session.org.id,
        buffer,
        renamedName,
        file.type
      )

      // Create DB record
      const document = await DocumentRepository.create({
        org_id: session.org.id,
        uploaded_by: session.id,
        original_name: file.name,
        renamed_name: renamedName,
        doc_type: docType,
        folder: duplicates.length > 0 ? 'duplicates_review' : folder,
        storage_path: docUpload.path,
        original_storage_path: originalUpload.path,
        file_size: file.size,
        mime_type: file.type,
        status: 'pending',
        is_duplicate: duplicates.length > 0,
        metadata: {
          content_hash: contentHash,
          original_folder: folder,
        },
      })

      // Auto-trigger extraction for non-duplicate documents
      let extraction = null
      if (duplicates.length === 0) {
        try {
          extraction = await runExtractionPipeline(document, session.org.id)
          if (extraction && !extraction.success) {
            console.error('[Extraction] Pipeline failed:', extraction.error)
          }
        } catch (extractionErr) {
          console.error('[Extraction] Unhandled error:', extractionErr)
          // Non-fatal — document is saved, extraction can be retried manually
        }
      }

      results.push({
        document,
        extraction,
        duplicates: duplicates.map(d => ({
          matched_document: d.document,
          confidence: d.confidence,
        })),
      })
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
