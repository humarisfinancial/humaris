import { createServerSupabaseClient } from '@/lib/db/server'
import type { ChartOfAccount, AccountType } from '@/types'

export interface CreateAccountInput {
  org_id: string
  code: string
  name: string
  type: AccountType
  parent_id?: string | null
}

export interface UpdateAccountInput {
  name?: string
  type?: AccountType
  parent_id?: string | null
}

export const ChartOfAccountsRepository = {
  async list(orgId: string): Promise<ChartOfAccount[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('org_id', orgId)
      .order('code', { ascending: true })

    if (error) throw new Error(`Failed to list chart of accounts: ${error.message}`)
    return data ?? []
  },

  async findById(id: string, orgId: string): Promise<ChartOfAccount | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()
    return data ?? null
  },

  async findByType(orgId: string, type: AccountType): Promise<ChartOfAccount[]> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('org_id', orgId)
      .eq('type', type)
      .order('code', { ascending: true })

    if (error) throw new Error(`Failed to list accounts by type: ${error.message}`)
    return data ?? []
  },

  async create(input: CreateAccountInput): Promise<ChartOfAccount> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert(input)
      .select()
      .single()

    if (error) throw new Error(`Failed to create account: ${error.message}`)
    return data
  },

  async update(id: string, orgId: string, updates: UpdateAccountInput): Promise<ChartOfAccount> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update account: ${error.message}`)
    return data
  },

  async delete(id: string, orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()

    // Check system account
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('is_system')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()

    if (data?.is_system) throw new Error('Cannot delete system accounts')

    const { error } = await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) throw new Error(`Failed to delete account: ${error.message}`)
  },

  async seedDefaults(orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.rpc('seed_default_chart_of_accounts', { p_org_id: orgId })
    if (error) throw new Error(`Failed to seed chart of accounts: ${error.message}`)
  },

  async countForOrg(orgId: string): Promise<number> {
    const supabase = await createServerSupabaseClient()
    const { count } = await supabase
      .from('chart_of_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
    return count ?? 0
  },
}
