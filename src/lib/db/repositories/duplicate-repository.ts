import { createServerSupabaseClient } from '@/lib/db/server'
import type { DuplicateConfidence, DuplicateFlag, DuplicateResolution } from '@/types'

export const DuplicateRepository = {
  async create(input: {
    org_id: string
    doc_id: string
    matched_doc_id?: string
    confidence: DuplicateConfidence
  }): Promise<DuplicateFlag> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('duplicate_flags')
      .insert(input)
      .select()
      .single()

    if (error) throw new Error(`Failed to create duplicate flag: ${error.message}`)
    return data
  },

  async listPending(orgId: string): Promise<DuplicateFlag[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('duplicate_flags')
      .select(`
        *,
        document:documents!duplicate_flags_doc_id_fkey(*),
        matched_document:documents!duplicate_flags_matched_doc_id_fkey(*)
      `)
      .eq('org_id', orgId)
      .is('resolution', null)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to list duplicate flags: ${error.message}`)
    return data ?? []
  },

  async resolve(
    id: string,
    orgId: string,
    resolution: DuplicateResolution,
    resolvedBy: string
  ): Promise<DuplicateFlag> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('duplicate_flags')
      .update({
        resolution,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw new Error(`Failed to resolve duplicate flag: ${error.message}`)
    return data
  },
}
