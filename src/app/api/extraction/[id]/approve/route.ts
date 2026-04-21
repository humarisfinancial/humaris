import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { ExtractionRepository } from '@/lib/db/repositories/extraction-repository'
import { DocumentRepository } from '@/lib/db/repositories/document-repository'
import { LedgerRepository } from '@/lib/db/repositories/ledger-repository'
import { ChartOfAccountsRepository } from '@/lib/db/repositories/chart-of-accounts-repository'
import { generateRenamedFilename, getFileExtension } from '@/lib/documents/renaming'
import { extractFilenameLabelHint } from '@/lib/documents/classification'

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

      const ext = getFileExtension(document.original_name)
      const filenameHint = extractFilenameLabelHint(document.original_name)
      const baseName = generateRenamedFilename({
        date: record.transaction_date ?? new Date(),
        docType: document.doc_type ?? 'other',
        vendor: record.vendor_name,
        invoiceNumber: record.invoice_number,
        originalHint: filenameHint,
        extension: ext,
      })
      updates.renamed_name = await DocumentRepository.uniqueRenamedName(session.org.id, baseName, document.id)

      await DocumentRepository.update(document.id, session.org.id, updates as never)
    }

    // Create double-entry ledger entries for the approved extraction.
    // Only transactional documents create ledger entries.
    // Financial statements, bank statements, spreadsheets, etc. are reference documents only.
    const LEDGER_DOC_TYPES = new Set(['invoice', 'receipt', 'expense_report', 'payroll_report', 'revenue_report'])
    if (record.amount && record.amount > 0 && document && LEDGER_DOC_TYPES.has(document.doc_type ?? '')) {
      try {
        // Total = subtotal + tax
        const totalAmount = record.amount + (record.tax_amount ?? 0)

        // Primary account per doc type
        const docTypeToAccountCode: Record<string, string> = {
          invoice: '6900',        // Other Expenses (expense)
          receipt: '6900',        // Other Expenses (expense)
          expense_report: '6900', // Other Expenses (expense)
          payroll_report: '6010', // Payroll Expenses (expense)
          revenue_report: '4010', // Product Sales (revenue)
        }
        // Offsetting account for double-entry
        const docTypeToOffsetCode: Record<string, string> = {
          invoice: '2010',        // Accounts Payable (liability)
          receipt: '2010',        // Accounts Payable (liability)
          expense_report: '2010', // Accounts Payable (liability)
          payroll_report: '2010', // Accounts Payable (liability)
          revenue_report: '1100', // Accounts Receivable (asset)
        }

        const targetCode = docTypeToAccountCode[document.doc_type ?? ''] ?? '6900'
        const offsetCode = docTypeToOffsetCode[document.doc_type ?? '']

        const accounts = await ChartOfAccountsRepository.list(session.org.id)
        const targetAccount = accounts.find(a => a.code === targetCode)
        const offsetAccount = offsetCode ? accounts.find(a => a.code === offsetCode) : null

        const entryDate = record.transaction_date ?? new Date().toISOString().split('T')[0]
        const descriptionParts = [
          record.vendor_name,
          record.invoice_number ? `#${record.invoice_number}` : null,
          document.doc_type?.replace(/_/g, ' '),
        ].filter(Boolean).join(' — ')

        if (targetAccount) {
          const isRevenue = targetAccount.type === 'revenue'

          // Primary entry (e.g. debit expense or credit revenue)
          await LedgerRepository.create({
            org_id: session.org.id,
            extracted_record_id: record.id,
            account_id: targetAccount.id,
            source_doc_id: document.id,
            entry_date: entryDate,
            description: descriptionParts,
            debit: isRevenue ? 0 : totalAmount,
            credit: isRevenue ? totalAmount : 0,
            is_manual: false,
            created_by: session.id,
          })

          // Offsetting entry for double-entry bookkeeping
          if (offsetAccount) {
            const offsetIsLiability = offsetAccount.type === 'liability'
            const offsetIsAsset = offsetAccount.type === 'asset'
            await LedgerRepository.create({
              org_id: session.org.id,
              extracted_record_id: record.id,
              account_id: offsetAccount.id,
              source_doc_id: document.id,
              entry_date: entryDate,
              description: descriptionParts,
              // Liability offset: credit (increases AP). Asset offset: debit (increases AR).
              debit: offsetIsAsset ? totalAmount : 0,
              credit: offsetIsLiability ? totalAmount : 0,
              is_manual: false,
              created_by: session.id,
            })
          }
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
