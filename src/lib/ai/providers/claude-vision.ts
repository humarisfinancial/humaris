import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionProvider } from '../extraction'
import type { DocumentType, LineItem } from '@/types'

/**
 * Claude Vision provider (Anthropic).
 * Uses claude-sonnet-4-6 for document classification and financial field extraction.
 *
 * Setup: Set ANTHROPIC_API_KEY in .env.local
 */
export class ClaudeVisionProvider implements ExtractionProvider {
  private get client(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async classify(fileBuffer: Buffer, mimeType: string): Promise<DocumentType> {
    const response = await this.callClaude(fileBuffer, mimeType, CLASSIFY_PROMPT)
    const lower = response.toLowerCase()
    if (lower.includes('invoice')) return 'invoice'
    if (lower.includes('receipt')) return 'receipt'
    if (lower.includes('bank statement')) return 'bank_statement'
    if (lower.includes('payroll')) return 'payroll_report'
    if (lower.includes('financial statement')) return 'financial_statement'
    if (lower.includes('expense')) return 'expense_report'
    if (lower.includes('revenue')) return 'revenue_report'
    return 'other'
  }

  async extract(fileBuffer: Buffer, mimeType: string, docType: DocumentType) {
    const prompt = EXTRACT_PROMPT(docType)
    const responseText = await this.callClaude(fileBuffer, mimeType, prompt)

    let parsed: Record<string, unknown> = {}
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      parsed = {}
    }

    const amount = parsed.amount ? parseFloat(String(parsed.amount)) : null
    const taxAmount = parsed.tax_amount ? parseFloat(String(parsed.tax_amount)) : null

    return {
      vendor_name: (parsed.vendor_name as string) ?? null,
      transaction_date: (parsed.transaction_date as string) ?? null,
      amount: isNaN(amount!) ? null : amount,
      tax_amount: isNaN(taxAmount!) ? null : taxAmount,
      invoice_number: (parsed.invoice_number as string) ?? null,
      payment_terms: (parsed.payment_terms as string) ?? null,
      line_items: (parsed.line_items as LineItem[]) ?? [],
      raw_fields: { claude_raw: responseText },
      confidence_score: 0.85,
      extraction_provider: 'claude-vision',
    }
  }

  private async callClaude(fileBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
    // Claude only supports image/* and application/pdf via the Files API
    // For other types, fall back to text-only prompt
    const supportedMedia = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    const isSupported = supportedMedia.includes(mimeType)

    const content: Anthropic.MessageParam['content'] = isSupported
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: fileBuffer.toString('base64'),
            },
          },
          { type: 'text', text: prompt },
        ]
      : [{ type: 'text', text: prompt }]

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    })

    return message.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('')
  }
}

const CLASSIFY_PROMPT = `You are a financial document classifier. Look at this document and respond with ONE of these exact document types: invoice, receipt, bank_statement, payroll_report, revenue_report, expense_report, financial_statement, spreadsheet, bank_check, other. Respond with only the type, nothing else.`

const EXTRACT_PROMPT = (docType: DocumentType) =>
  `You are a financial data extraction system. This is a ${docType.replace(/_/g, ' ')}. Extract the following fields and return them as a JSON object:
{
  "vendor_name": "string or null",
  "transaction_date": "YYYY-MM-DD or null",
  "amount": number or null (total amount due/paid),
  "tax_amount": number or null,
  "invoice_number": "string or null",
  "payment_terms": "string or null",
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "total": number}]
}
Return only the JSON object, no other text.`
