// ============================================================
// Core domain types — generated from DB schema
// ============================================================

export type OrgRole = 'owner' | 'admin' | 'accountant' | 'ops' | 'viewer'

export type DocumentType =
  | 'invoice'
  | 'receipt'
  | 'bank_statement'
  | 'payroll_report'
  | 'revenue_report'
  | 'expense_report'
  | 'financial_statement'
  | 'spreadsheet'
  | 'bank_check'
  | 'other'

export type DocumentFolder =
  | 'invoices'
  | 'expenses'
  | 'revenue'
  | 'inventory'
  | 'bank_statements'
  | 'payroll'
  | 'finance_accounting'
  | 'original_uploads'
  | 'duplicates_review'
  | 'other'

export type DocumentStatus =
  | 'pending'
  | 'processing'
  | 'extracted'
  | 'review_required'
  | 'approved'
  | 'failed'

export type DuplicateConfidence = 'exact' | 'likely' | 'possible'
export type DuplicateResolution = 'keep_new' | 'keep_existing' | 'keep_both' | 'decide_later'
export type ExtractionStatus = 'pending' | 'review' | 'approved' | 'rejected'
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type StatementType = 'pnl' | 'balance_sheet' | 'cash_flow'

// ============================================================
// Entity types
// ============================================================

export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_super_admin: boolean
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  created_at: string
  updated_at: string
  user?: UserProfile
}

export interface Document {
  id: string
  org_id: string
  uploaded_by: string
  original_name: string
  renamed_name: string | null
  doc_type: DocumentType | null
  folder: DocumentFolder
  storage_path: string
  original_storage_path: string | null
  file_size: number
  mime_type: string | null
  status: DocumentStatus
  is_duplicate: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DuplicateFlag {
  id: string
  org_id: string
  doc_id: string
  matched_doc_id: string | null
  confidence: DuplicateConfidence
  resolution: DuplicateResolution | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  document?: Document
  matched_document?: Document
}

export interface ExtractedRecord {
  id: string
  org_id: string
  document_id: string
  vendor_name: string | null
  transaction_date: string | null
  amount: number | null
  tax_amount: number | null
  invoice_number: string | null
  payment_terms: string | null
  line_items: LineItem[]
  raw_fields: Record<string, unknown>
  confidence_score: number | null
  status: ExtractionStatus
  reviewed_by: string | null
  reviewed_at: string | null
  extraction_provider: string | null
  created_at: string
  updated_at: string
}

export interface LineItem {
  description: string
  quantity?: number
  unit_price?: number
  total: number
}

export interface ChartOfAccount {
  id: string
  org_id: string
  code: string
  name: string
  type: AccountType
  parent_id: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface LedgerEntry {
  id: string
  org_id: string
  extracted_record_id: string | null
  account_id: string
  source_doc_id: string | null
  entry_date: string
  description: string | null
  debit: number
  credit: number
  category: string | null
  is_manual: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  account?: ChartOfAccount
}

export interface FinancialStatement {
  id: string
  org_id: string
  type: StatementType
  period_start: string
  period_end: string
  granularity: string | null
  data: StatementData
  generated_by: string | null
  generated_at: string
}

export interface StatementData {
  sections: StatementSection[]
  totals: Record<string, number>
  metadata: Record<string, unknown>
}

export interface StatementSection {
  label: string
  code?: string
  amount: number
  children?: StatementSection[]
}

// ============================================================
// Auth / session context
// ============================================================

export interface SessionUser {
  id: string
  email: string
  profile: UserProfile
  org: Organization
  role: OrgRole
  is_super_admin: boolean
}

// ============================================================
// API response wrappers
// ============================================================

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: { message: string; code?: string }
}

export type ApiResult<T> = ApiSuccess<T> | ApiError

// ============================================================
// Pagination
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

export interface PaginationParams {
  page?: number
  per_page?: number
}
