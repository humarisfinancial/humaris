import type { ExtractionProvider } from '../extraction'
import type { DocumentType } from '@/types'

/**
 * Google Document AI provider.
 * Handles invoice, receipt, bank statement, and general form parsing.
 *
 * Setup:
 * 1. Create a processor in Google Cloud Console (Document AI)
 * 2. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path
 */
export class GoogleDocumentAIProvider implements ExtractionProvider {
  private projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  private processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID
  private location = 'us'

  async classify(fileBuffer: Buffer, mimeType: string): Promise<DocumentType> {
    // Keyword-based classification from the document text extracted by Document AI
    const text = await this.extractRawText(fileBuffer, mimeType)
    return classifyFromText(text)
  }

  async extract(fileBuffer: Buffer, mimeType: string, docType: DocumentType) {
    if (!this.projectId || !this.processorId) {
      throw new Error(
        'Google Document AI not configured. Set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_DOCUMENT_AI_PROCESSOR_ID.'
      )
    }

    // @ts-expect-error — optional peer dependency, install when configuring Google Document AI
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai').catch(() => {
      throw new Error('Install @google-cloud/documentai: npm install @google-cloud/documentai')
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (DocumentProcessorServiceClient as any)()
    const processorName = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType,
      },
    })

    const document = result.document
    if (!document) throw new Error('Document AI returned no document')

    return parseDocumentAIResponse(document, docType)
  }

  private async extractRawText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    if (!this.projectId || !this.processorId) {
      return ''
    }
    try {
      // @ts-expect-error — optional peer dependency
      const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = new (DocumentProcessorServiceClient as any)()
      const processorName = `projects/${this.projectId}/locations/${this.location}/processors/${this.processorId}`
      const [result] = await client.processDocument({
        name: processorName,
        rawDocument: { content: fileBuffer.toString('base64'), mimeType },
      })
      return result.document?.text ?? ''
    } catch {
      return ''
    }
  }
}

function classifyFromText(text: string): DocumentType {
  const lower = text.toLowerCase()
  if (lower.includes('invoice')) return 'invoice'
  if (lower.includes('receipt')) return 'receipt'
  if (lower.includes('bank statement') || lower.includes('account statement')) return 'bank_statement'
  if (lower.includes('payroll') || lower.includes('payslip')) return 'payroll_report'
  if (lower.includes('profit') || lower.includes('loss') || lower.includes('income statement')) return 'financial_statement'
  if (lower.includes('expense report')) return 'expense_report'
  if (lower.includes('revenue')) return 'revenue_report'
  return 'other'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDocumentAIResponse(document: any, _docType: DocumentType) {
  const entities = document.entities ?? []

  const getField = (type: string): string | undefined => {
    const entity = entities.find((e: any) => e.type === type)
    return entity?.mentionText ?? entity?.normalizedValue?.text
  }

  const amountStr = getField('total_amount') ?? getField('net_amount')
  const taxStr = getField('total_tax_amount')

  const lineItems = (entities as any[])
    .filter(e => e.type === 'line_item')
    .map(e => {
      const props = e.properties ?? []
      const get = (t: string) => props.find((p: any) => p.type === t)?.mentionText
      return {
        description: get('line_item/description') ?? '',
        quantity: parseFloat(get('line_item/quantity') ?? '1'),
        unit_price: parseFloat(get('line_item/unit_price') ?? '0'),
        total: parseFloat(get('line_item/amount') ?? '0'),
      }
    })

  return {
    vendor_name: getField('supplier_name') ?? getField('vendor_name') ?? null,
    transaction_date: getField('invoice_date') ?? getField('receipt_date') ?? null,
    amount: amountStr ? parseFloat(amountStr.replace(/[^0-9.]/g, '')) : null,
    tax_amount: taxStr ? parseFloat(taxStr.replace(/[^0-9.]/g, '')) : null,
    invoice_number: getField('invoice_id') ?? null,
    payment_terms: getField('payment_terms') ?? null,
    line_items: lineItems,
    raw_fields: { entities: entities.map((e: any) => ({ type: e.type, value: e.mentionText })) },
    confidence_score: document.pages?.[0]?.blocks?.[0]?.layout?.confidence ?? null,
    extraction_provider: 'google-document-ai',
  }
}
