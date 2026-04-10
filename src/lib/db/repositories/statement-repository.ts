import { createServerSupabaseClient } from '@/lib/db/server'
import type { FinancialStatement, StatementData, StatementType } from '@/types'

export const StatementRepository = {
  async getCached(
    orgId: string,
    type: StatementType,
    periodStart: string,
    periodEnd: string
  ): Promise<FinancialStatement | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('org_id', orgId)
      .eq('type', type)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .single()
    return data ?? null
  },

  async saveCache(
    orgId: string,
    type: StatementType,
    periodStart: string,
    periodEnd: string,
    data: StatementData,
    generatedBy: string | null
  ): Promise<FinancialStatement> {
    const supabase = await createServerSupabaseClient()

    // Delete existing cache entry first, then insert fresh
    await supabase
      .from('financial_statements')
      .delete()
      .eq('org_id', orgId)
      .eq('type', type)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)

    const { data: row, error } = await supabase
      .from('financial_statements')
      .insert({
        org_id: orgId,
        type,
        period_start: periodStart,
        period_end: periodEnd,
        data,
        generated_by: generatedBy,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to cache statement: ${error.message}`)
    return row
  },

  async clearCacheForOrg(orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    await supabase
      .from('financial_statements')
      .delete()
      .eq('org_id', orgId)
  },
}
