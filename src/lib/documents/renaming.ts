import type { DocumentType } from '@/types'

/**
 * Generates a standardized filename.
 *
 * Format: [YYYY.MM.DD] [Doc Type] [Vendor] [Ref# or Period].[ext]
 *
 * The `originalHint` (cleaned original filename) is appended when it
 * contains information not already covered by type label or vendor —
 * e.g. "Q1 2026" for a financial statement.
 *
 * Examples:
 *   2026.03.12 Invoice Google Ads INV-001.pdf
 *   2026.03.30 Financial Statement Humaris Financial Group Q1 2026.pdf
 *   2026.03.12 Google Ads.pdf             ← unknown type, vendor known
 *   2026.03.12 14.32.pdf                  ← nothing known, use time
 *
 * "Keep Both" duplicate adds a version suffix:
 *   2026.03.12 Invoice Google Ads (v2).pdf
 */
export function generateRenamedFilename(options: {
  date?: Date | string
  docType: DocumentType | string
  vendor?: string | null
  invoiceNumber?: string | null
  originalHint?: string | null
  extension: string
  version?: number
}): string {
  const { date, docType, vendor, invoiceNumber, originalHint, extension, version } = options

  const d = date ? new Date(date) : new Date()
  const dateStr = formatDate(d)
  const ext = extension.startsWith('.') ? extension : `.${extension}`

  // Only include type label for known types (not 'other')
  const typeLabel = docType !== 'other'
    ? (DOCUMENT_TYPE_LABELS[docType as DocumentType] ?? null)
    : null

  const vendorStr = vendor?.trim() ? sanitizePart(vendor, 50) : null
  const refStr = invoiceNumber?.trim() ? sanitizePart(invoiceNumber, 30) : null

  // Include originalHint only when it adds info not already in typeLabel or vendorStr
  let hintStr: string | null = null
  if (originalHint?.trim()) {
    const hintLower = originalHint.toLowerCase()
    const typeLower = typeLabel?.toLowerCase() ?? ''
    const vendorLower = vendorStr?.toLowerCase() ?? ''
    // Check it's not purely redundant
    const alreadyCovered =
      (typeLower && hintLower.includes(typeLower)) &&
      (vendorLower ? hintLower.includes(vendorLower) : true)
    if (!alreadyCovered) {
      // Strip parts that are already present in typeLabel or vendorStr
      let stripped = originalHint
      if (typeLabel) {
        const typeRe = new RegExp(escapeRe(typeLabel), 'gi')
        stripped = stripped.replace(typeRe, '').trim()
      }
      if (vendorStr) {
        const vendorRe = new RegExp(escapeRe(vendorStr), 'gi')
        stripped = stripped.replace(vendorRe, '').trim()
      }
      stripped = sanitizePart(stripped.replace(/\s+/g, ' ').trim(), 40)
      if (stripped.length >= 3) hintStr = stripped
    }
  }

  const parts = [typeLabel, vendorStr, hintStr].filter(Boolean)

  // If nothing is known, use HH.MM to ensure uniqueness across same-day uploads
  const body = parts.length > 0 ? parts.join(' ') : formatTime(d)

  const versionSuffix = version && version > 1 ? ` (v${version})` : ''

  return `${dateStr} ${body}${versionSuffix}${ext}`
}

function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}.${m}`
}

function sanitizePart(s: string, maxLen: number): string {
  return s
    .trim()
    .replace(/[/\\:*?"<>|—–]/g, '')  // filesystem-unsafe + em/en dashes
    .replace(/\s+/g, ' ')
    .slice(0, maxLen)
    .trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
