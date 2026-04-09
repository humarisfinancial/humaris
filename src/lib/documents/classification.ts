import type { DocumentFolder, DocumentType } from '@/types'

/**
 * Classifies a document type from its filename and MIME type.
 * Sprint 3 will replace this with Google Document AI for content-based classification.
 */
export function classifyDocumentType(
  filename: string,
  _mimeType: string
): DocumentType {
  const lower = filename.toLowerCase()

  if (lower.includes('invoice')) return 'invoice'
  if (lower.includes('receipt')) return 'receipt'
  if (lower.includes('bank') && (lower.includes('statement') || lower.includes('stmt'))) return 'bank_statement'
  if (lower.includes('payroll') || lower.includes('payslip') || lower.includes('pay_stub')) return 'payroll_report'
  if (lower.includes('p&l') || lower.includes('profit') || lower.includes('income_statement')) return 'financial_statement'
  if (lower.includes('expense')) return 'expense_report'
  if (lower.includes('revenue') || lower.includes('sales')) return 'revenue_report'
  if (lower.includes('check') || lower.includes('cheque')) return 'bank_check'

  return 'other'
}

/**
 * Maps a document type to the appropriate folder.
 */
export function getFolderForDocType(docType: DocumentType): DocumentFolder {
  const map: Record<DocumentType, DocumentFolder> = {
    invoice: 'invoices',
    receipt: 'expenses',
    bank_statement: 'bank_statements',
    payroll_report: 'payroll',
    revenue_report: 'revenue',
    expense_report: 'expenses',
    financial_statement: 'finance_accounting',
    spreadsheet: 'finance_accounting',
    bank_check: 'bank_statements',
    other: 'other',
  }
  return map[docType]
}
