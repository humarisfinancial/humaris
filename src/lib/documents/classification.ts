import type { DocumentFolder, DocumentType } from '@/types'

/**
 * Classifies a document type from its filename and MIME type.
 * Uses an expanded keyword set so common naming patterns are caught at upload time.
 * AI-based content classification in the extraction pipeline will override this when available.
 */
export function classifyDocumentType(
  filename: string,
  _mimeType: string
): DocumentType {
  const lower = filename.toLowerCase().replace(/[_\-\.]/g, ' ')

  // Bank statement — check before generic 'bank' to avoid false positives
  if (
    (lower.includes('bank') && (lower.includes('statement') || lower.includes('stmt') || lower.includes('account'))) ||
    lower.includes('bank stmt') ||
    lower.includes('checking') ||
    lower.includes('savings account')
  ) return 'bank_statement'

  // Payroll
  if (
    lower.includes('payroll') ||
    lower.includes('payslip') ||
    lower.includes('pay stub') ||
    lower.includes('pay slip') ||
    lower.includes('paystub') ||
    lower.includes('salary') ||
    lower.includes('wage')
  ) return 'payroll_report'

  // Financial statement / P&L
  if (
    lower.includes('p&l') ||
    lower.includes('profit') ||
    lower.includes('income statement') ||
    lower.includes('financial statement') ||
    lower.includes('balance sheet') ||
    lower.includes('trial balance') ||
    lower.includes('cash flow statement') ||
    lower.includes('quarterly report') ||
    lower.includes('annual report') ||
    lower.includes('q1 ') || lower.includes('q2 ') || lower.includes('q3 ') || lower.includes('q4 ')
  ) return 'financial_statement'

  // Revenue / sales
  if (
    lower.includes('revenue') ||
    lower.includes('sales') ||
    lower.includes('sales invoice') ||
    lower.includes('sales order') ||
    lower.includes('statement of account')
  ) return 'revenue_report'

  // Expense report
  if (
    lower.includes('expense report') ||
    lower.includes('expenses') ||
    lower.includes('reimbursement')
  ) return 'expense_report'

  // Receipt
  if (
    lower.includes('receipt') ||
    lower.includes('rcpt')
  ) return 'receipt'

  // Invoice — broad match last among invoice-like types
  if (
    lower.includes('invoice') ||
    lower.includes('inv ') ||
    lower.includes(' inv') ||
    lower.includes('bill') ||
    lower.includes('purchase order') ||
    lower.includes(' po ') ||
    lower.includes('vendor statement')
  ) return 'invoice'

  // Bank check
  if (
    lower.includes('check') ||
    lower.includes('cheque')
  ) return 'bank_check'

  // Spreadsheet
  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.includes('spreadsheet')
  ) return 'spreadsheet'

  return 'other'
}

/**
 * Extracts a human-readable supplemental label from the original filename.
 * Used as a suffix hint (e.g. period reference like "Q1 2026") in renamed filenames.
 * Returns null when nothing meaningful remains after stripping noise.
 */
export function extractFilenameLabelHint(filename: string): string | null {
  // Remove extension
  const stem = filename.replace(/\.[^.]+$/, '')

  let s = stem
    // Normalise separators: em/en dashes, underscores, hyphens → space
    .replace(/[—–_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Strip invoice/reference number patterns WHOLE before stripping numbers,
  // so we don't leave orphaned stubs like "INV" or "PO".
  // Matches: INV-2026-0312, PO-123, REF-ABC-001, #12345, etc.
  s = s.replace(/\b(INV|PO|REF|REC|CHK|CHECK|BILL|ORD|ORDER)\s*[-#]?\s*[\w\-]+/gi, '')

  // Strip numeric date patterns but KEEP quarter/period labels (Q1 2026, FY 2025)
  s = s
    .replace(/\b\d{4}[-./]\d{2}[-./]\d{2}\b/g, '')  // 2026-03-12
    .replace(/\b\d{8}\b/g, '')                        // 20260312
    .replace(/\b\d{4}\b(?!\s*(q[1-4]|fy|quarter|half))/gi, '') // bare 4-digit years not following period labels
    // Protect quarter references: Q1 2026 → keep as-is (strip the year only if truly standalone)

  // Strip doc-type noise words
  const noise = [
    'invoice', 'receipt', 'bank', 'statement', 'stmt', 'payroll', 'payslip',
    'expense', 'report', 'revenue', 'sales', 'financial', 'income', 'balance',
    'sheet', 'check', 'cheque', 'spreadsheet', 'document', 'doc', 'file',
    'final', 'draft', 'copy', 'scan', 'scanned', 'signed', 'approved',
    'v1', 'v2', 'v3',
  ]
  const noiseRe = new RegExp(`\\b(${noise.join('|')})\\b`, 'gi')
  s = s.replace(noiseRe, '').replace(/\s+/g, ' ').trim()

  // Strip leading/trailing non-alphanumeric characters
  s = s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim()

  // Discard if too short to be meaningful (e.g. leftover "INV" or single letter)
  if (!s || s.length < 3) return null

  // Title-case
  return s.replace(/\b\w/g, c => c.toUpperCase())
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
