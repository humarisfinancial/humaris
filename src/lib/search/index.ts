import { createServerSupabaseClient } from '@/lib/db/server'

export interface SearchResult {
  id: string
  type: 'document' | 'transaction' | 'vendor'
  title: string
  subtitle: string
  url: string
}

export interface SearchProvider {
  search(query: string, orgId: string, limit?: number): Promise<SearchResult[]>
}

/** Stub interface for future external connectors (Gmail, Slack). No MVP implementation. */
export interface ExternalSearchProvider extends SearchProvider {
  readonly providerName: string
}

export const postgresSearchProvider: SearchProvider = {
  async search(query: string, orgId: string, limit = 20): Promise<SearchResult[]> {
    const supabase = await createServerSupabaseClient()

    const [docsResult, entriesResult, vendorsResult] = await Promise.all([
      supabase
        .from('documents')
        .select('id, renamed_name, original_name, doc_type, folder')
        .eq('org_id', orgId)
        .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
        .order('created_at', { ascending: false })
        .limit(limit),

      supabase
        .from('ledger_entries')
        .select('id, description, entry_date, debit, credit')
        .eq('org_id', orgId)
        .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
        .order('entry_date', { ascending: false })
        .limit(limit),

      supabase
        .from('extracted_records')
        .select('id, vendor_name, transaction_date')
        .eq('org_id', orgId)
        .ilike('vendor_name', `%${query}%`)
        .order('transaction_date', { ascending: false })
        .limit(limit),
    ])

    const results: SearchResult[] = []

    for (const d of (docsResult.data ?? [])) {
      results.push({
        id: d.id,
        type: 'document',
        title: d.renamed_name ?? d.original_name ?? 'Untitled',
        subtitle: [d.doc_type, d.folder].filter(Boolean).join(' · '),
        url: `/documents/${d.id}`,
      })
    }

    for (const e of (entriesResult.data ?? [])) {
      results.push({
        id: e.id,
        type: 'transaction',
        title: e.description ?? 'Transaction',
        subtitle: `${e.entry_date} · ${e.debit > 0 ? `Debit $${e.debit}` : `Credit $${e.credit}`}`,
        url: `/ledger?highlight=${e.id}`,
      })
    }

    const seenVendors = new Set<string>()
    for (const v of (vendorsResult.data ?? [])) {
      if (v.vendor_name && !seenVendors.has(v.vendor_name)) {
        seenVendors.add(v.vendor_name)
        results.push({
          id: v.id,
          type: 'vendor',
          title: v.vendor_name,
          subtitle: `Last seen: ${v.transaction_date ?? 'unknown'}`,
          url: `/documents?vendor=${encodeURIComponent(v.vendor_name)}`,
        })
      }
    }

    return results
  },
}
