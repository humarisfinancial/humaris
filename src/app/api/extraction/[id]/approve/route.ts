import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { ChartOfAccountsRepository } from '@/lib/db/repositories/chart-of-accounts-repository'
import { generateRenamedFilename, getFileExtension } from '@/lib/documents/renaming'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (!permissions.extraction.review(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const record = await ExtractionRepository.findById(id, session.org.id)
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (record.status === 'approved') {
      return NextResponse.json({ error: 'Record already approved' }, { status: 409 })
    }

    // Approve the extraction record
    const approved = await ExtractionRepository.update(id, session.org.id, {
      status: 'approved',
      reviewed_by: session.id,
      reviewed_at: new Date().toISOString(),
    })

    // Update document: mark extracted + update renamed_name with vendor
    const document = await DocumentRepository.findById(record.document_id, session.org.id)
    if (document) {
      const updates: Record<string, unknown> = { status: 'approved' }

      if (record.vendor_name) {
        const ext = getFileExtension(document.original_name)
        updates.renamed_name = generateRenamedFilename({
          date: record.transaction_date ?? new Date(),
          docType: document.doc_type ?? 'other',
          vendor: record.vendor_name,
          extension: ext,
        })
      }

      await DocumentRepository.update(document.id, session.org.id, updates as never)
    }

    // Create ledger entry for the approved extraction
    if (record.amount && record.amount > 0 && document) {
      try {
        // Determine account based on doc type — default to Accounts Payable (2010)
        // or find the matching expense account
        const docTypeToAccountCode: Record<string, string> = {
          invoice: '2010',     // Accounts Payable
          receipt: '6900',     // Other Expenses
          expense_report: '6900',
          payroll_report: '6010', // Payroll
          revenue_report: '4010', // Product Sales
          bank_statement: '1020', // Checking Account
        }
        const targetCode = docTypeToAccountCode[document.doc_type ?? ''] ?? '6900'

        const accounts = await ChartOfAccountsRepository.list(session.org.id)
        const targetAccount = accounts.find(a => a.code === targetCode)

        if (targetAccount) {
          const isRevenue = targetAccount.type === 'revenue'
          await LedgerRepository.create({
            org_id: session.org.id,
            extracted_record_id: record.id,
            account_id: targetAccount.id,
            source_doc_id: document.id,
            entry_date: record.transaction_date ?? new Date().toISOString().split('T')[0],
            description: [
              record.vendor_name,
              record.invoice_number ? `#${record.invoice_number}` : null,
              document.doc_type?.replace(/_/g, ' '),
            ].filter(Boolean).join(' — '),
            debit: isRevenue ? 0 : record.amount,
            credit: isRevenue ? record.amount : 0,
            is_manual: false,
            created_by: session.id,
          })
        }
      } catch {
        // Non-fatal — extraction is approved, ledger entry can be added manually
        console.warn('[Ledger] Failed to auto-create ledger entry for extraction', record.id)
      }
    }

    return NextResponse.json({ record: approved })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to approve' },
      { status: 500 }
    )
  }
}
