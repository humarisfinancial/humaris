import type { LineItem } from '@/types'

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

/**
 * Validates extracted financial fields before storing.
 * Returns issues list (empty = valid).
 */
export function validateExtractedFields(fields: {
  vendor_name?: string | null
  transaction_date?: string | null
  amount?: number | null
  tax_amount?: number | null
  line_items?: LineItem[]
}): ValidationResult {
  const issues: string[] = []

  // Amount must be positive if present
  if (fields.amount !== null && fields.amount !== undefined) {
    if (typeof fields.amount !== 'number' || isNaN(fields.amount)) {
      issues.push('Amount is not a valid number')
    } else if (fields.amount < 0) {
      issues.push('Amount cannot be negative')
    }
  }

  // Tax amount must be positive if present
  if (fields.tax_amount !== null && fields.tax_amount !== undefined) {
    if (fields.tax_amount < 0) {
      issues.push('Tax amount cannot be negative')
    }
    if (fields.amount && fields.tax_amount > fields.amount) {
      issues.push('Tax amount exceeds total amount')
    }
  }

  // Date must be parseable if present
  if (fields.transaction_date) {
    const parsed = new Date(fields.transaction_date)
    if (isNaN(parsed.getTime())) {
      issues.push('Transaction date is not a valid date')
    } else if (parsed > new Date()) {
      issues.push('Transaction date is in the future')
    }
  }

  // Line items: totals should roughly match amount (within 5%)
  if (fields.line_items && fields.line_items.length > 0 && fields.amount) {
    const lineItemTotal = fields.line_items.reduce((sum, li) => sum + (li.total ?? 0), 0)
    const diff = Math.abs(lineItemTotal - fields.amount)
    if (lineItemTotal > 0 && diff / fields.amount > 0.05) {
      issues.push(`Line item total ($${lineItemTotal.toFixed(2)}) doesn't match invoice total ($${fields.amount.toFixed(2)})`)
    }
  }

  return { valid: issues.length === 0, issues }
}

/** Confidence threshold below which records go to review queue */
export const CONFIDENCE_THRESHOLD = 0.75

export function requiresReview(confidenceScore: number | null): boolean {
  if (confidenceScore === null) return true
  return confidenceScore < CONFIDENCE_THRESHOLD
}
