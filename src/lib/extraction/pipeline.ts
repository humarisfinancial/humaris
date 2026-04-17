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
import type { Document, ExtractionStatus, LineItem } from '@/types'

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

    // 6. Apply defaults for missing fields and track which were auto-populated
    const { fields: filledFields, auto_populated } = applyExtractionDefaults(extracted, docType ?? 'other')

    // 7. Validate extracted fields
    const validation = validateExtractedFields({
      vendor_name: filledFields.vendor_name,
      transaction_date: filledFields.transaction_date,
      amount: filledFields.amount,
      tax_amount: filledFields.tax_amount,
      line_items: filledFields.line_items,
    })

    // 8. Always send to review — human approval required before ledger entry is created
    const recordStatus: ExtractionStatus = 'review'

    // 9. Store extraction record
    const record = await ExtractionRepository.create({
      org_id: orgId,
      document_id: document.id,
      vendor_name: filledFields.vendor_name,
      transaction_date: filledFields.transaction_date,
      amount: filledFields.amount,
      tax_amount: filledFields.tax_amount,
      invoice_number: filledFields.invoice_number,
      payment_terms: filledFields.payment_terms,
      line_items: filledFields.line_items,
      raw_fields: {
        ...filledFields.raw_fields,
        validation_issues: validation.issues,
        auto_populated,
      },
      confidence_score: filledFields.confidence_score,
      status: recordStatus,
      reviewed_by: null,
      reviewed_at: null,
      extraction_provider: filledFields.extraction_provider ?? 'unknown',
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

    // Update renamed_name using invoice date + vendor from extraction
    // Use filledFields so we get the transaction_date and vendor_name after defaults are applied
    const ext = getFileExtension(document.original_name)
    updates.renamed_name = generateRenamedFilename({
      date: filledFields.transaction_date ?? new Date(),
      docType: docType ?? 'other',
      vendor: filledFields.vendor_name,
      extension: ext,
    })

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

/** US combined average sales tax rate used when no tax amount is found in the document. */
const DEFAULT_TAX_RATE = 0.0825 // 8.25%

/**
 * Fills in missing invoice fields with sensible defaults.
 * Returns the enriched fields and a list of field names that were auto-populated.
 */
function applyExtractionDefaults(
  extracted: {
    vendor_name: string | null
    transaction_date: string | null
    amount: number | null
    tax_amount: number | null
    invoice_number: string | null
    payment_terms: string | null
    line_items: LineItem[]
    raw_fields: Record<string, unknown>
    confidence_score: number | null
    extraction_provider?: string | null
  },
  docType: string
): { fields: typeof extracted; auto_populated: string[] } {
  const auto_populated: string[] = []
  const fields = { ...extracted }

  // Only auto-populate for invoice-like documents
  const isInvoiceLike = ['invoice', 'receipt', 'expense_report'].includes(docType)
  if (!isInvoiceLike) return { fields, auto_populated }

  // Invoice number — generate a unique reference if not found
  if (!fields.invoice_number) {
    const today = new Date()
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    fields.invoice_number = `INV-${datePart}-${rand}`
    auto_populated.push('invoice_number')
  }

  // Payment terms — default to Net 30
  if (!fields.payment_terms) {
    fields.payment_terms = 'Net 30'
    auto_populated.push('payment_terms')
  }

  // Tax amount — estimate from total using standard rate if not found
  if (fields.tax_amount === null && fields.amount !== null && fields.amount > 0) {
    const year = new Date().getFullYear()
    fields.tax_amount = parseFloat((fields.amount * DEFAULT_TAX_RATE).toFixed(2))
    fields.raw_fields = {
      ...fields.raw_fields,
      auto_tax_rate: DEFAULT_TAX_RATE,
      auto_tax_rate_year: year,
    }
    auto_populated.push('tax_amount')
  }

  return { fields, auto_populated }
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
