'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Trash2, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useDeleteDocument } from '@/hooks/use-documents'
import { toast } from 'sonner'
import type { Document } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  extracted: 'bg-purple-100 text-purple-700',
  review_required: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
}

interface DocumentTableProps {
  documents: Document[]
  isLoading: boolean
}

const DEFAULT_COL_WIDTHS = { name: 280, type: 140, status: 130, size: 80, uploaded: 120 }

function useColumnResize(initial: typeof DEFAULT_COL_WIDTHS) {
  const [widths, setWidths] = useState(initial)
  const dragging = useRef<{ col: keyof typeof initial; startX: number; startW: number } | null>(null)

  const onMouseDown = useCallback((col: keyof typeof initial, e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = { col, startX: e.clientX, startW: widths[col] }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const { col, startX, startW } = dragging.current
      const newW = Math.max(60, startW + (ev.clientX - startX))
      setWidths(prev => ({ ...prev, [col]: newW }))
    }
    const onUp = () => {
      dragging.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widths])

  return { widths, onMouseDown }
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group z-10 flex items-center justify-center"
    >
      <div className="w-px h-4 bg-gray-300 group-hover:bg-blue-400 transition-colors" />
    </div>
  )
}

export function DocumentTable({ documents, isLoading }: DocumentTableProps) {
  const { mutate: deleteDoc } = useDeleteDocument()
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const { widths, onMouseDown } = useColumnResize(DEFAULT_COL_WIDTHS)

  function confirmDelete() {
    if (!deleteTarget) return
    deleteDoc(deleteTarget.id, {
      onSuccess: () => toast.success('Document deleted'),
      onError: () => toast.error('Failed to delete document'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No documents found</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', width: Object.values(widths).reduce((a, b) => a + b, 0) + 64 }}>
        <colgroup>
          <col style={{ width: widths.name }} />
          <col style={{ width: widths.type }} />
          <col style={{ width: widths.status }} />
          <col style={{ width: widths.size }} />
          <col style={{ width: widths.uploaded }} />
          <col style={{ width: 64 }} />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {(
              [
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'status', label: 'Status' },
                { key: 'size', label: 'Size' },
                { key: 'uploaded', label: 'Uploaded' },
              ] as const
            ).map(({ key, label }) => (
              <th key={key} className="relative text-left px-4 py-3 font-medium text-gray-600 overflow-hidden">
                {label}
                <ResizeHandle onMouseDown={(e) => onMouseDown(key, e)} />
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {documents.map(doc => (
            <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 overflow-hidden">
                <div className="flex items-center gap-2">
                  {doc.is_duplicate && (
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" aria-label="Duplicate flagged" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate" title={doc.renamed_name ?? doc.original_name}>
                      {doc.renamed_name ?? doc.original_name}
                    </p>
                    {doc.renamed_name && doc.renamed_name !== doc.original_name && (
                      <p className="text-xs text-gray-400 truncate" title={doc.original_name}>
                        Original: {doc.original_name}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 capitalize truncate overflow-hidden">
                {doc.doc_type?.replace(/_/g, ' ') ?? '—'}
              </td>
              <td className="px-4 py-3 overflow-hidden">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {doc.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{formatBytes(doc.file_size)}</td>
              <td className="px-4 py-3 text-gray-600">{formatDate(doc.created_at)}</td>
              <td className="px-4 py-3 w-px whitespace-nowrap">
                <div className="flex items-center gap-1 justify-end">
                  <Link href={`/documents/${doc.id}`}>
                    <Button variant="ghost" size="icon-sm" aria-label="Open document">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete document"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTarget(doc)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete document"
        description={`Delete "${deleteTarget?.renamed_name ?? deleteTarget?.original_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        destructive
      />
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
