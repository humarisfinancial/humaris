/**
 * Extraction pipeline — orchestrates the full OCR → extract → validate → store flow.
 * Called after document upload or manually via the process API.
 */

import { getExtractionProvider } from '@/lib/ai/extraction'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { generateRenamedFilename, getFileExtension } from '@/lib/documents/renaming'
import { classifyDocumentType, getFolderForDocType } from '@/lib/documents/classification'
import { validateExtractedFields } from '@/lib/extraction/validators'
import { createServerSupabaseClient } from '@/lib/db/server'
import type { Document, ExtractionStatus } from '@/types'

export interface PipelineResult {
  success: boolean
  extractionRecordId?: string
  status: ExtractionStatus | 'failed'
  issues?: string[]
  error?: string
}

/**
 * Runs the full extraction pipeline for a single document.
 * Downloads the file from storage, runs OCR + extraction, validates, and stores.
 */
export async function runExtractionPipeline(
  document: Document,
  orgId: string
): Promise<PipelineResult> {
  try {
    // 1. Update document status to processing
    await DocumentRepository.update(document.id, orgId, { status: 'processing' })

    // 2. Download the file buffer from storage
    const fileBuffer = await downloadDocumentBuffer(document.storage_path)

    const mimeType = document.mime_type ?? 'application/octet-stream'

    // 3. Get the extraction provider
    const provider = await getExtractionProvider()

    // 4. Classify document type (AI-based now, overrides filename-based from Sprint 2)
    let docType = document.doc_type
    try {
      docType = await provider.classify(fileBuffer, mimeType)
    } catch {
      // Classification failure is non-fatal — keep the existing type
    }

    // 5. Extract financial fields (fall back to mock if provider is unavailable)
    let extracted
    try {
      extracted = await provider.extract(fileBuffer, mimeType, docType ?? 'other')
    } catch (providerErr) {
      console.warn('[Extraction] Provider failed, falling back to mock:', providerErr instanceof Error ? providerErr.message : providerErr)
      const { MockExtractionProvider } = await import('@/lib/ai/providers/google-doc-ai')
      extracted = await new MockExtractionProvider().extract(fileBuffer, mimeType, docType ?? 'other')
    }

    // 6. Validate extracted fields
    const validation = validateExtractedFields({
      vendor_name: extracted.vendor_name,
      transaction_date: extracted.transaction_date,
      amount: extracted.amount,
      tax_amount: extracted.tax_amount,
      line_items: extracted.line_items,
    })

    // 7. Always send to review — human approval required before ledger entry is created
    const recordStatus: ExtractionStatus = 'review'

    // 8. Store extraction record
    const record = await ExtractionRepository.create({
      org_id: orgId,
      document_id: document.id,
      vendor_name: extracted.vendor_name,
      transaction_date: extracted.transaction_date,
      amount: extracted.amount,
      tax_amount: extracted.tax_amount,
      invoice_number: extracted.invoice_number,
      payment_terms: extracted.payment_terms,
      line_items: extracted.line_items,
      raw_fields: {
        ...extracted.raw_fields,
        validation_issues: validation.issues,
      },
      confidence_score: extracted.confidence_score,
      status: recordStatus,
      reviewed_by: null,
      reviewed_at: null,
      extraction_provider: extracted.extraction_provider ?? 'unknown',
    })

    // 9. Update document status to review_required (approval always required)
    const docStatus = 'review_required'
    const updates: Partial<Document> = {
      status: docStatus,
      doc_type: docType ?? document.doc_type,
    }

    // Update folder based on confirmed doc type
    if (docType && docType !== document.doc_type && document.folder !== 'duplicates_review') {
      updates.folder = getFolderForDocType(docType)
    }

    // Update renamed_name with vendor info if available (will be finalized on approval)
    if (extracted.vendor_name && false) {
      const ext = getFileExtension(document.original_name)
      updates.renamed_name = generateRenamedFilename({
        date: extracted.transaction_date ?? new Date(),
        docType: docType ?? 'other',
        vendor: extracted.vendor_name,
        extension: ext,
      })
    }

    await DocumentRepository.update(document.id, orgId, updates)

    return {
      success: true,
      extractionRecordId: record.id,
      status: recordStatus,
      issues: validation.issues,
    }
  } catch (err) {
    // Mark document as failed
    await DocumentRepository.update(document.id, orgId, { status: 'failed' })
      .catch(() => { /* ignore secondary failure */ })

    return {
      success: false,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown extraction error',
    }
  }
}

async function downloadDocumentBuffer(storagePath: string): Promise<Buffer> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.storage
    .from('financial-documents')
    .download(storagePath)

  if (error) throw new Error(`Failed to download document: ${error.message}`)

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
