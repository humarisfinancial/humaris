import type { DocumentType, ExtractedRecord } from '@/types'

/**
 * Provider-agnostic extraction interface.
 * Swap providers by changing the implementation — no feature code changes needed.
 */
export interface ExtractionProvider {
  /** Classify the document type from file bytes */
  classify(fileBuffer: Buffer, mimeType: string): Promise<DocumentType>

  /** Extract structured financial fields from the document */
  extract(
    fileBuffer: Buffer,
    mimeType: string,
    docType: DocumentType
  ): Promise<Omit<ExtractedRecord, 'id' | 'org_id' | 'document_id' | 'status' | 'reviewed_by' | 'reviewed_at' | 'created_at' | 'updated_at'>>
}

/**
 * Get the active extraction provider based on environment configuration.
 * Defaults to Google Document AI.
 */
export async function getExtractionProvider(): Promise<ExtractionProvider> {
  // Future: switch based on env var EXTRACTION_PROVIDER=gpt4o
  const { GoogleDocumentAIProvider } = await import('./providers/google-doc-ai')
  return new GoogleDocumentAIProvider()
}
