import { createServerSupabaseClient } from '@/lib/db/server'
import type { AccountBalance, LedgerEntry, PaginatedResult, PaginationParams } from '@/types'

export type { AccountBalance } from '@/types'

export interface CreateLedgerEntryInput {
  org_id: string
  extracted_record_id?: string | null
  account_id: string
  source_doc_id?: string | null
  entry_date: string
  description?: string | null
  debit: number
  credit: number
  category?: string | null
  is_manual?: boolean
  created_by?: string | null
}

export interface UpdateLedgerEntryInput {
  account_id?: string
  entry_date?: string
  description?: string | null
  debit?: number
  credit?: number
  category?: string | null
}

export interface LedgerListFilters {
  account_id?: string
  date_from?: string
  date_to?: string
  is_manual?: boolean
  search?: string
}

export const LedgerRepository = {
  async create(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('ledger_entries')
      .insert(input)
      .select('*, account:chart_of_accounts(*)')
      .single()

    if (error) throw new Error(`Failed to create ledger entry: ${error.message}`)
    return data
  },

  async createFromExtraction(
    orgId: string,
    extractedRecordId: string,
    docId: string,
    amount: number,
    accountId: string,
    entryDate: string,
    description: string,
    createdBy: string
  ): Promise<LedgerEntry> {
    return LedgerRepository.create({
      org_id: orgId,
      extracted_record_id: extractedRecordId,
      account_id: accountId,
      source_doc_id: docId,
      entry_date: entryDate,
      description,
      debit: amount,
      credit: 0,
      is_manual: false,
      created_by: createdBy,
    })
  },

  async findById(id: string, orgId: string): Promise<LedgerEntry | null> {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('ledger_entries')
      .select('*, account:chart_of_accounts(*)')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()
    return data ?? null
  },

  async list(
    orgId: string,
    filters: LedgerListFilters = {},
    pagination: PaginationParams = {}
  ): Promise<PaginatedResult<LedgerEntry>> {
    const supabase = await createServerSupabaseClient()
    const { page = 1, per_page = 50 } = pagination
    const offset = (page - 1) * per_page

    let query = supabase
      .from('ledger_entries')
      .select('*, account:chart_of_accounts(*), creator:user_profiles!created_by(full_name, email)', { count: 'exact' })
      .eq('org_id', orgId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.account_id) query = query.eq('account_id', filters.account_id)
    if (filters.date_from) query = query.gte('entry_date', filters.date_from)
    if (filters.date_to) query = query.lte('entry_date', filters.date_to)
    if (filters.is_manual !== undefined) query = query.eq('is_manual', filters.is_manual)

    const { data, count, error } = await query.range(offset, offset + per_page - 1)

    if (error) throw new Error(`Failed to list ledger entries: ${error.message}`)

    return {
      items: data ?? [],
      total: count ?? 0,
      page,
      per_page,
      has_more: (count ?? 0) > offset + per_page,
    }
  },

  async update(id: string, orgId: string, updates: UpdateLedgerEntryInput): Promise<LedgerEntry> {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('ledger_entries')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, account:chart_of_accounts(*)')
      .single()

    if (error) throw new Error(`Failed to update ledger entry: ${error.message}`)
    return data
  },

  async delete(id: string, orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .from('ledger_entries')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) throw new Error(`Failed to delete ledger entry: ${error.message}`)
  },

  async getAccountBalances(orgId: string, dateFrom?: string, dateTo?: string): Promise<AccountBalance[]> {
    const supabase = await createServerSupabaseClient()

    let query = supabase
      .from('ledger_entries')
      .select('account_id, debit, credit, entry_date, account:chart_of_accounts(code, name, type)')
      .eq('org_id', orgId)

    if (dateFrom) query = query.gte('entry_date', dateFrom)
    if (dateTo) query = query.lte('entry_date', dateTo)

    const { data, error } = await query

    if (error) throw new Error(`Failed to get account balances: ${error.message}`)

    const balanceMap = new Map<string, AccountBalance>()

    for (const entry of data ?? []) {
      const acc = (entry.account as unknown) as { code: string; name: string; type: string } | null
      if (!acc) continue

      const existing = balanceMap.get(entry.account_id)
      if (existing) {
        existing.total_debit += Number(entry.debit)
        existing.total_credit += Number(entry.credit)
        existing.balance = existing.total_debit - existing.total_credit
      } else {
        balanceMap.set(entry.account_id, {
          account_id: entry.account_id,
          account_code: acc.code,
          account_name: acc.name,
          account_type: acc.type as AccountBalance['account_type'],
          total_debit: Number(entry.debit),
          total_credit: Number(entry.credit),
          balance: Number(entry.debit) - Number(entry.credit),
        })
      }
    }

    return Array.from(balanceMap.values()).sort((a, b) =>
      a.account_code.localeCompare(b.account_code)
    )
  },
}
