import type { DocumentType } from '@/types'

/**
 * Generates a standardized filename.
 *
 * Format: [YYYY.MM.DD] [Document Type] [Vendor or Source]
 * Example: 2026.02.18 Invoice ABC Supply.pdf
 *
 * If vendor is unknown: 2026.02.18 Invoice.pdf
 * If "Keep Both" duplicate: 2026.02.18 Invoice ABC Supply (v2).pdf
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
  const typeLabel = DOCUMENT_TYPE_LABELS[docType] ?? 'Document'
  const ext = extension.startsWith('.') ? extension : `.${extension}`

  const parts = [dateStr, typeLabel]
  if (vendor?.trim()) parts.push(sanitizeVendorName(vendor))

  const base = parts.join(' ')
  const versionSuffix = version && version > 1 ? ` (v${version})` : ''

  return `${base}${versionSuffix}${ext}`
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
