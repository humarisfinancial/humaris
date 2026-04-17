'use client'

import { useState, useEffect } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useUpdateExtraction, useApproveExtraction, useRejectExtraction } from '@/hooks/use-extraction'
import type { ExtractedRecord } from '@/types'

interface ExtractionFormProps {
  record: ExtractedRecord
  onApproved?: () => void
  onRejected?: () => void
}

const DEFAULT_TAX_RATE = 0.0825

const AUTO_POPULATED_LABELS: Record<string, string> = {
  invoice_number: 'Invoice #',
  payment_terms: 'Payment Terms',
  tax_amount: 'Tax Amount',
}

/**
 * Compute initial field values and which ones needed auto-population.
 * Runs both when the pipeline already stored defaults (via raw_fields.auto_populated)
 * AND as a fallback for older records that predate the pipeline change.
 */
function initFields(record: ExtractedRecord) {
  // Start from whatever the pipeline stored
  const pipelineAutoPop: string[] = Array.isArray(
    (record.raw_fields as Record<string, unknown>)?.auto_populated
  ) ? ((record.raw_fields as Record<string, unknown>).auto_populated as string[]) : []

  const localAutoPop = [...pipelineAutoPop]

  let invoice_number = record.invoice_number ?? ''
  let payment_terms = record.payment_terms ?? ''
  let tax_amount = record.tax_amount !== null ? String(record.tax_amount) : ''

  // Apply defaults for any fields still missing (covers old records)
  if (!invoice_number && !localAutoPop.includes('invoice_number')) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(1000 + Math.random() * 9000)
    invoice_number = `INV-${datePart}-${rand}`
    localAutoPop.push('invoice_number')
  }

  if (!payment_terms && !localAutoPop.includes('payment_terms')) {
    payment_terms = 'Net 30'
    localAutoPop.push('payment_terms')
  }

  const amount = record.amount
  if (!tax_amount && amount !== null && amount > 0 && !localAutoPop.includes('tax_amount')) {
    tax_amount = String(parseFloat((amount * DEFAULT_TAX_RATE).toFixed(2)))
    localAutoPop.push('tax_amount')
  }

  const autoTaxRate = (record.raw_fields as Record<string, unknown>)?.auto_tax_rate as number | undefined
    ?? (localAutoPop.includes('tax_amount') ? DEFAULT_TAX_RATE : undefined)

  return {
    fields: {
      vendor_name: record.vendor_name ?? '',
      transaction_date: record.transaction_date ?? '',
      amount: amount !== null ? String(amount) : '',
      tax_amount,
      invoice_number,
      payment_terms,
    },
    autoPopulated: localAutoPop,
    autoTaxRate,
  }
}

export function ExtractionForm({ record, onApproved, onRejected }: ExtractionFormProps) {
  const init = initFields(record)
  const [fields, setFields] = useState(init.fields)
  const [autoPopulated, setAutoPopulated] = useState<string[]>(init.autoPopulated)
  const [autoTaxRate] = useState<number | undefined>(init.autoTaxRate)
  const [dirty, setDirty] = useState(false)

  const { mutateAsync: update, isPending: isSaving } = useUpdateExtraction()
  const { mutateAsync: approve, isPending: isApproving } = useApproveExtraction()
  const { mutateAsync: reject, isPending: isRejecting } = useRejectExtraction()

  useEffect(() => {
    const next = initFields(record)
    setFields(next.fields)
    setAutoPopulated(next.autoPopulated)
    setDirty(false)
  }, [record.id])

  function handleChange(field: keyof typeof fields, value: string) {
    setFields(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  async function handleSave() {
    await update({
      id: record.id,
      updates: {
        vendor_name: fields.vendor_name || null,
        transaction_date: fields.transaction_date || null,
        amount: fields.amount ? parseFloat(fields.amount) : null,
        tax_amount: fields.tax_amount ? parseFloat(fields.tax_amount) : null,
        invoice_number: fields.invoice_number || null,
        payment_terms: fields.payment_terms || null,
      },
    })
    setDirty(false)
    toast.success('Changes saved')
  }

  async function handleApprove() {
    if (dirty) await handleSave()
    await approve(record.id)
    toast.success('Extraction approved — document updated')
    onApproved?.()
  }

  async function handleReject() {
    try {
      await reject(record.id)
      toast.info('Extraction rejected — re-run extraction to try again')
      onRejected?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject')
    }
  }

  const confidencePct = record.confidence_score !== null
    ? Math.round(record.confidence_score * 100)
    : null
  const confidenceColor =
    confidencePct === null ? 'text-gray-500'
    : confidencePct >= 85 ? 'text-green-600'
    : confidencePct >= 70 ? 'text-yellow-600'
    : 'text-red-600'

  const isMock = record.raw_fields && (record.raw_fields as Record<string, unknown>).mock === true

  return (
    <div className="space-y-6">
      {/* Auto-populated fields banner */}
      {autoPopulated.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Some fields were auto-populated</p>
            <p className="text-amber-700 mt-0.5">
              The following fields were not found in the uploaded file and have been filled with
              default values. Please review and correct them before approving:
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {autoPopulated.map(field => (
                <li key={field} className="text-amber-700">
                  <span className="font-medium">{AUTO_POPULATED_LABELS[field] ?? field}</span>
                  {field === 'invoice_number' && ' — generated reference number'}
                  {field === 'payment_terms' && ' — defaulted to Net 30'}
                  {field === 'tax_amount' && autoTaxRate !== undefined &&
                    ` — estimated at ${(autoTaxRate * 100).toFixed(2)}% (${new Date().getFullYear()} standard rate)`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Confidence + provider info */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
        <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Confidence:</span>
            <span className={`font-semibold ${confidenceColor}`}>
              {confidencePct !== null ? `${confidencePct}%` : 'Unknown'}
            </span>
            {confidencePct !== null && confidencePct < 75 && (
              <span className="flex items-center gap-1 text-yellow-600 text-xs">
                <AlertTriangle className="w-3 h-3" />
                Low — please verify fields
              </span>
            )}
          </div>
          <p className="text-gray-500">
            Provider: {record.extraction_provider ?? '—'}
            {isMock && <span className="ml-2 text-yellow-600">(Mock — configure Google Document AI for real extraction)</span>}
          </p>
        </div>
      </div>

      {/* Extracted fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="vendor_name">Vendor / Supplier</Label>
          <Input
            id="vendor_name"
            value={fields.vendor_name}
            onChange={e => handleChange('vendor_name', e.target.value)}
            placeholder="e.g. ABC Supply Co."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transaction_date">Transaction Date</Label>
          <Input
            id="transaction_date"
            type="date"
            value={fields.transaction_date}
            onChange={e => handleChange('transaction_date', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Total Amount ($)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={fields.amount}
            onChange={e => handleChange('amount', e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="tax_amount">Tax Amount ($)</Label>
            {autoPopulated.includes('tax_amount') && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                Auto-filled
              </span>
            )}
          </div>
          <Input
            id="tax_amount"
            type="number"
            step="0.01"
            min="0"
            value={fields.tax_amount}
            onChange={e => handleChange('tax_amount', e.target.value)}
            placeholder="0.00"
            className={autoPopulated.includes('tax_amount') ? 'border-amber-300 bg-amber-50/50' : ''}
          />
          {autoPopulated.includes('tax_amount') && autoTaxRate !== undefined && (
            <p className="text-xs text-amber-600">
              Estimated at {(autoTaxRate * 100).toFixed(2)}% standard rate — verify against your invoice
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="invoice_number">Invoice / Reference #</Label>
            {autoPopulated.includes('invoice_number') && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                Auto-filled
              </span>
            )}
          </div>
          <Input
            id="invoice_number"
            value={fields.invoice_number}
            onChange={e => handleChange('invoice_number', e.target.value)}
            placeholder="e.g. INV-00123"
            className={autoPopulated.includes('invoice_number') ? 'border-amber-300 bg-amber-50/50' : ''}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="payment_terms">Payment Terms</Label>
            {autoPopulated.includes('payment_terms') && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
                Auto-filled
              </span>
            )}
          </div>
          <Input
            id="payment_terms"
            value={fields.payment_terms}
            onChange={e => handleChange('payment_terms', e.target.value)}
            placeholder="e.g. Net 30"
            className={autoPopulated.includes('payment_terms') ? 'border-amber-300 bg-amber-50/50' : ''}
          />
        </div>
      </div>

      {/* Line items (read-only preview) */}
      {record.line_items && record.line_items.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Line Items</p>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Unit Price</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {record.line_items.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-900">{item.description}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{item.quantity ?? 1}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.unit_price != null ? `$${item.unit_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      ${(item.total ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {record.status === 'review' && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {dirty && (
            <Button variant="outline" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50 ml-auto"
            onClick={handleReject}
            disabled={isRejecting || isApproving}
          >
            <X className="w-4 h-4 mr-2" />
            {isRejecting ? 'Rejecting...' : 'Reject'}
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
          >
            <Check className="w-4 h-4 mr-2" />
            {isApproving ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      )}

      {record.status === 'approved' && (
        <div className="flex items-center gap-2 text-sm text-green-700 p-3 bg-green-50 rounded-lg">
          <Check className="w-4 h-4" />
          Approved — data sent to ledger
        </div>
      )}

      {record.status === 'rejected' && (
        <div className="flex items-center gap-2 text-sm text-red-700 p-3 bg-red-50 rounded-lg border border-red-200">
          <X className="w-4 h-4" />
          Rejected — use the &ldquo;Extract Data&rdquo; button above to re-run extraction
        </div>
      )}
    </div>
  )
}
