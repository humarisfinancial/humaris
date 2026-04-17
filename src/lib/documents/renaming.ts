import type { DocumentType } from '@/types'

/**
 * Generates a standardized filename.
 *
 * Format: [YYYY.MM.DD] [Vendor Name].[ext]
 * Example: 2026.02.18 Google Ads.pdf
 *
 * Falls back to doc type label when vendor is unknown:
 *   2026.02.18 Invoice.pdf
 *
 * "Keep Both" duplicate adds a version suffix:
 *   2026.02.18 Google Ads (v2).pdf
 */
export function generateRenamedFilename(options: {
  date?: Date | string
  docType: DocumentType
  vendor?: string | null
  extension: string
  version?: number
}): string {
  const { date, docType, vendor, extension, version } = options

  const d = date ? new Date(date) : new Date()
  const dateStr = formatDate(d)
  const ext = extension.startsWith('.') ? extension : `.${extension}`

  // Prefer vendor name; fall back to doc-type label as a placeholder
  const label = vendor?.trim()
    ? sanitizeVendorName(vendor)
    : (DOCUMENT_TYPE_LABELS[docType] ?? 'Document')

  const versionSuffix = version && version > 1 ? ` (v${version})` : ''

  return `${dateStr} ${label}${versionSuffix}${ext}`
}

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function sanitizeVendorName(name: string): string {
  return name
    .trim()
    .replace(/[/\\:*?"<>|]/g, '') // remove filesystem-unsafe chars
    .replace(/\s+/g, ' ')
    .slice(0, 50) // cap length
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  bank_statement: 'Bank Statement',
  payroll_report: 'Payroll Report',
  revenue_report: 'Revenue Report',
  expense_report: 'Expense Report',
  financial_statement: 'Financial Statement',
  spreadsheet: 'Spreadsheet',
  bank_check: 'Bank Check',
  other: 'Document',
}
