import type { DocumentType, ExtractedRecord } from '@/types'

/**
 * Provider-agnostic extraction interface.
 * Swap providers by changing EXTRACTION_PROVIDER env var or by updating getExtractionProvider().
 */
export interface ExtractionProvider {
  /** Classify the document type from file bytes */
  classify(fileBuffer: Buffer, mimeType: string): Promise<DocumentType>

  /** Extract structured financial fields from the document */
  extract(
    fileBuffer: Buffer,
    mimeType: string,
    docType: DocumentType
  ): Promise<Omit<ExtractedRecord,
    'id' | 'org_id' | 'document_id' | 'status' |
    'reviewed_by' | 'reviewed_at' | 'created_at' | 'updated_at'
  >>
}

/**
 * Get the active extraction provider.
 *
 * EXTRACTION_PROVIDER env var:
 *   'claude' (default) → Claude Vision (claude-sonnet-4-6) — requires ANTHROPIC_API_KEY
 *   'gpt4o'            → GPT-4o Vision — requires OPENAI_API_KEY
 *   'google'           → Google Document AI — requires GOOGLE_CLOUD_* vars (falls back to mock)
 */
export async function getExtractionProvider(): Promise<ExtractionProvider> {
  const provider = process.env.EXTRACTION_PROVIDER ?? 'claude'

  if (provider === 'claude') {
    const { ClaudeVisionProvider } = await import('./providers/claude-vision')
    return new ClaudeVisionProvider()
  }

  if (provider === 'gpt4o') {
    const { GPT4oVisionProvider } = await import('./providers/gpt4o-vision')
    return new GPT4oVisionProvider()
  }

  const { GoogleDocumentAIProvider } = await import('./providers/google-doc-ai')
  return new GoogleDocumentAIProvider()
}
