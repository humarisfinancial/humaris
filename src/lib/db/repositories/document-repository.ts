import { createServerSupabaseClient } from '@/lib/db/server'
import type { Document, DocumentFolder, DocumentStatus, DocumentType, PaginatedResult, PaginationParams } from '@/types'

export interface CreateDocumentInput {
  org_id: string
  uploaded_by: string
  original_name: string
  renamed_name?: string
  doc_type?: DocumentType
  folder?: DocumentFolder
  storage_path: string
  original_storage_path?: string
  file_size: number
  mime_type?: string
  status?: DocumentStatus
  is_duplicate?: boolean
  metadata?: Record<string, unknown>
}

export interface ListDocumentsFilter {
  folder?: DocumentFolder
  status?: DocumentStatus
  doc_type?: DocumentType
  is_duplicate?: boolean
  search?: string
}

export const DocumentRepository = {
  async create(input: CreateDocumentInput): Promise<Document> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('documents')
      .insert(input)
      .select()
      .single()

    if (error) throw new Error(`Failed to create document: ${error.message}`)
    return data
  },

  async findById(id: string, orgId: string): Promise<Document | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()
    return data ?? null
  },

  async list(
    orgId: string,
    filter: ListDocumentsFilter = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<Document>> {
    const supabase = await createServerSupabaseClient()
    const { page = 1, per_page = 50 } = pagination
    const offset = (page - 1) * per_page

    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1)

    if (filter.folder) query = query.eq('folder', filter.folder)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.doc_type) query = query.eq('doc_type', filter.doc_type)
    if (filter.is_duplicate !== undefined) query = query.eq('is_duplicate', filter.is_duplicate)
    if (filter.search) {
      query = query.or(
        `renamed_name.ilike.%${filter.search}%,original_name.ilike.%${filter.search}%`
      )
    }

    const { data, count, error } = await query
    if (error) throw new Error(`Failed to list documents: ${error.message}`)

    return {
      items: data ?? [],
      total: count ?? 0,
      page,
      per_page,
      has_more: (count ?? 0) > offset + per_page,
    }
  },

  async update(id: string, orgId: string, updates: Partial<Document>): Promise<Document> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update document: ${error.message}`)
    return data
  },

  async delete(id: string, orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) throw new Error(`Failed to delete document: ${error.message}`)
  },

  /** Count documents in the duplicates_review folder with no resolution */
  async countPendingDuplicates(orgId: string): Promise<number> {
    const supabase = await createServerSupabaseClient()
    const { count } = await supabase
      .from('duplicate_flags')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('resolution', null)

    return count ?? 0
  },

  /**
   * Returns a renamed_name guaranteed to be unique within the org.
   * If `baseName` is already taken, appends (2), (3), … until a free slot is found.
   * Pass `excludeId` to ignore the current document (useful during rename-on-approve).
   */
  async uniqueRenamedName(orgId: string, baseName: string, excludeId?: string): Promise<string> {
    const supabase = await createServerSupabaseClient()
    const ext = baseName.includes('.') ? '.' + baseName.split('.').pop()! : ''
    const stem = ext ? baseName.slice(0, -ext.length) : baseName

    let candidate = baseName
    let counter = 1

    while (true) {
      let query = supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('renamed_name', candidate)

      if (excludeId) query = query.neq('id', excludeId)

      const { count } = await query
      if (!count) return candidate

      counter++
      candidate = `${stem} (${counter})${ext}`
    }
  },

  /** Find documents with matching content hash (exact duplicate) */
  async findByHash(orgId: string, hash: string): Promise<Document[]> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('org_id', orgId)
      .eq('metadata->>content_hash', hash)

    return data ?? []
  },
}
