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

export function ExtractionForm({ record, onApproved, onRejected }: ExtractionFormProps) {
  const [fields, setFields] = useState({
    vendor_name: record.vendor_name ?? '',
    transaction_date: record.transaction_date ?? '',
    amount: record.amount !== null ? String(record.amount) : '',
    tax_amount: record.tax_amount !== null ? String(record.tax_amount) : '',
    invoice_number: record.invoice_number ?? '',
    payment_terms: record.payment_terms ?? '',
  })
  const [dirty, setDirty] = useState(false)

  const { mutateAsync: update, isPending: isSaving } = useUpdateExtraction()
  const { mutateAsync: approve, isPending: isApproving } = useApproveExtraction()
  const { mutateAsync: reject, isPending: isRejecting } = useRejectExtraction()

  useEffect(() => {
    setFields({
      vendor_name: record.vendor_name ?? '',
      transaction_date: record.transaction_date ?? '',
      amount: record.amount !== null ? String(record.amount) : '',
      tax_amount: record.tax_amount !== null ? String(record.tax_amount) : '',
      invoice_number: record.invoice_number ?? '',
      payment_terms: record.payment_terms ?? '',
    })
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
    await reject(record.id)
    toast.info('Extraction rejected — document reset to pending')
    onRejected?.()
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
          <Label htmlFor="tax_amount">Tax Amount ($)</Label>
          <Input
            id="tax_amount"
            type="number"
            step="0.01"
            min="0"
            value={fields.tax_amount}
            onChange={e => handleChange('tax_amount', e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice_number">Invoice / Reference #</Label>
          <Input
            id="invoice_number"
            value={fields.invoice_number}
            onChange={e => handleChange('invoice_number', e.target.value)}
            placeholder="e.g. INV-00123"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payment_terms">Payment Terms</Label>
          <Input
            id="payment_terms"
            value={fields.payment_terms}
            onChange={e => handleChange('payment_terms', e.target.value)}
            placeholder="e.g. Net 30"
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
    </div>
  )
}
