'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDeleteDocument } from '@/hooks/use-documents'
import { toast } from 'sonner'
import type { Document } from '@/types'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { mutate: deleteDoc } = useDeleteDocument()

  const { data: doc, isLoading } = useQuery<Document & { signed_url?: string }>({
    queryKey: ['document', id],
    queryFn: () => fetch(`/api/documents/${id}`).then(r => r.json()),
  })

  function handleDelete() {
    if (!confirm('Delete this document? This cannot be undone.')) return
    deleteDoc(id, {
      onSuccess: () => {
        toast.success('Document deleted')
        router.push('/documents')
      },
      onError: () => toast.error('Failed to delete document'),
    })
  }

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-32 bg-gray-100 rounded" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Document not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/documents')}>
          Back to Documents
        </Button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {doc.renamed_name ?? doc.original_name}
              </h1>
              {doc.renamed_name && (
                <p className="text-sm text-gray-400 mt-0.5">Original: {doc.original_name}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {doc.signed_url && (
              <a href={doc.signed_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Document Type</p>
            <p className="font-medium text-gray-900 capitalize">
              {doc.doc_type?.replace(/_/g, ' ') ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Folder</p>
            <p className="font-medium text-gray-900 capitalize">
              {doc.folder.replace(/_/g, ' ')}
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Status</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
              {doc.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <p className="text-gray-500 mb-1">File Size</p>
            <p className="font-medium text-gray-900">{formatBytes(doc.file_size)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Uploaded</p>
            <p className="font-medium text-gray-900">{formatDate(doc.created_at)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">MIME Type</p>
            <p className="font-medium text-gray-900">{doc.mime_type ?? '—'}</p>
          </div>
        </div>

        {/* Extraction placeholder */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Extracted Data</p>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">
              {doc.status === 'pending'
                ? 'This document is queued for data extraction.'
                : doc.status === 'extracted' || doc.status === 'approved'
                ? 'Extraction complete — view in Ledger.'
                : 'Processing...'}
            </p>
          </div>
        </div>
      </div>
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
  return new Date(str).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
