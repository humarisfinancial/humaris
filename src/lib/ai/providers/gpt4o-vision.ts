import type { ExtractionProvider } from '../extraction'
import type { DocumentType, LineItem } from '@/types'

/**
 * GPT-4o Vision fallback provider.
 * Used when Google Document AI is unavailable or for document types it handles poorly.
 *
 * Setup: Set OPENAI_API_KEY in .env.local
 */
export class GPT4oVisionProvider implements ExtractionProvider {
  private get isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  async classify(fileBuffer: Buffer, mimeType: string): Promise<DocumentType> {
    if (!this.isConfigured) throw new Error('OPENAI_API_KEY not set')

    const base64 = fileBuffer.toString('base64')
    const response = await callGPT4o(base64, mimeType, CLASSIFY_PROMPT)

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
    if (!this.isConfigured) throw new Error('OPENAI_API_KEY not set')

    const base64 = fileBuffer.toString('base64')
    const prompt = EXTRACT_PROMPT(docType)
    const responseText = await callGPT4o(base64, mimeType, prompt)

    let parsed: Record<string, unknown> = {}
    try {
      // GPT-4o is instructed to return JSON
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
      raw_fields: { gpt_raw: responseText },
      confidence_score: 0.82, // GPT-4o tends to be reliable for structured docs
      extraction_provider: 'gpt4o-vision',
    }
  }
}

async function callGPT4o(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ''
}

const CLASSIFY_PROMPT = `You are a financial document classifier. Look at this document and respond with ONE of these exact document types: invoice, receipt, bank_statement, payroll_report, revenue_report, expense_report, financial_statement, spreadsheet, bank_check, other. Respond with only the type, nothing else.`

const EXTRACT_PROMPT = (docType: DocumentType) => `You are a financial data extraction system. This is a ${docType.replace(/_/g, ' ')}. Extract the following fields and return them as a JSON object:
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
