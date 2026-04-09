/**
 * Search abstraction — Postgres FTS today, Typesense/Algolia later.
 * Swap implementations by replacing the body of these functions.
 */

import { createServerSupabaseClient } from '@/lib/db/server'

export interface SearchResult {
  id: string
  type: 'document' | 'transaction' | 'vendor'
  title: string
  subtitle: string
  url: string
  score?: number
}

export async function search(
  query: string,
  orgId: string,
  limit = 20
): Promise<SearchResult[]> {
  const supabase = await createServerSupabaseClient()
  const results: SearchResult[] = []

  // Search documents
  const { data: docs } = await supabase
    .from('documents')
    .select('id, renamed_name, original_name, doc_type, folder')
    .eq('org_id', orgId)
    .or(`renamed_name.ilike.%${query}%,original_name.ilike.%${query}%`)
    .limit(limit)

  if (docs) {
    results.push(...docs.map(d => ({
      id: d.id,
      type: 'document' as const,
      title: d.renamed_name ?? d.original_name,
      subtitle: d.doc_type ?? d.folder,
      url: `/documents/${d.id}`,
    })))
  }

  // Search transactions/ledger
  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('id, description, entry_date, debit, credit')
    .eq('org_id', orgId)
    .ilike('description', `%${query}%`)
    .limit(limit)

  if (entries) {
    results.push(...entries.map(e => ({
      id: e.id,
      type: 'transaction' as const,
      title: e.description ?? 'Transaction',
      subtitle: `${e.entry_date} · ${e.debit > 0 ? `Debit $${e.debit}` : `Credit $${e.credit}`}`,
      url: `/ledger?highlight=${e.id}`,
    })))
  }

  // Search vendors (from extracted records)
  const { data: vendors } = await supabase
    .from('extracted_records')
    .select('id, vendor_name, transaction_date, amount')
    .eq('org_id', orgId)
    .ilike('vendor_name', `%${query}%`)
    .limit(limit)

  if (vendors) {
    const seen = new Set<string>()
    results.push(
      ...vendors
        .filter(v => v.vendor_name && !seen.has(v.vendor_name) && seen.add(v.vendor_name!))
        .map(v => ({
          id: v.id,
          type: 'vendor' as const,
          title: v.vendor_name!,
          subtitle: `Last transaction: ${v.transaction_date ?? 'unknown'}`,
          url: `/documents?vendor=${encodeURIComponent(v.vendor_name!)}`,
        }))
    )
  }

  return results.slice(0, limit)
}

export async function indexDocument(documentId: string, text: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.from('document_search').upsert({
    document_id: documentId,
    search_vector: `to_tsvector('english', '${text.replace(/'/g, "''")}')`
  })
}
