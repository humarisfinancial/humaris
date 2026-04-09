import { createServerSupabaseClient } from '@/lib/db/server'
import type { ExtractedRecord, ExtractionStatus, PaginatedResult, PaginationParams } from '@/types'

export interface UpdateExtractedRecordInput {
  vendor_name?: string | null
  transaction_date?: string | null
  amount?: number | null
  tax_amount?: number | null
  invoice_number?: string | null
  payment_terms?: string | null
  line_items?: unknown[]
  status?: ExtractionStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export const ExtractionRepository = {
  async create(input: Omit<ExtractedRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ExtractedRecord> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('extracted_records')
      .insert(input)
      .select()
      .single()

    if (error) throw new Error(`Failed to create extraction record: ${error.message}`)
    return data
  },

  async findById(id: string, orgId: string): Promise<ExtractedRecord | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('extracted_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()
    return data ?? null
  },

  async findByDocumentId(documentId: string, orgId: string): Promise<ExtractedRecord | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('extracted_records')
      .select('*')
      .eq('document_id', documentId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data ?? null
  },

  async listForReview(
    orgId: string,
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<ExtractedRecord>> {
    const supabase = await createServerSupabaseClient()
    const { page = 1, per_page = 25 } = pagination
    const offset = (page - 1) * per_page

    const { data, count, error } = await supabase
      .from('extracted_records')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('status', 'review')
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1)

    if (error) throw new Error(`Failed to list extraction review queue: ${error.message}`)

    return {
      items: data ?? [],
      total: count ?? 0,
      page,
      per_page,
      has_more: (count ?? 0) > offset + per_page,
    }
  },

  async update(id: string, orgId: string, updates: UpdateExtractedRecordInput): Promise<ExtractedRecord> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('extracted_records')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update extraction record: ${error.message}`)
    return data
  },

  async countPendingReview(orgId: string): Promise<number> {
    const supabase = await createServerSupabaseClient()
    const { count } = await supabase
      .from('extracted_records')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'review')
    return count ?? 0
  },
}
