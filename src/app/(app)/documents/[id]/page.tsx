'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { ArrowLeft, FileText, Download, Trash2, Zap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeleteDocument } from '@/hooks/use-documents'
import { useProcessDocument, useExtractionRecord, useExtractionByDocument } from '@/hooks/use-extraction'
import { ExtractionForm } from '@/components/extraction/extraction-form'
import { toast } from 'sonner'
import type { Document, ExtractedRecord } from '@/types'

function DocumentDetailContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reviewId = searchParams.get('review')

  const { mutate: deleteDoc } = useDeleteDocument()
  const { mutateAsync: processDoc, isPending: isProcessing } = useProcessDocument()

  const { data: doc, isLoading, refetch } = useQuery<Document & { signed_url?: string }>({
    queryKey: ['document', id],
    queryFn: () => fetch(`/api/documents/${id}`).then(r => r.json()),
  })

  // Load extraction record — from query param if present, otherwise look up by document
  const extractionId = reviewId ?? ''
  const { data: extractionById, refetch: refetchById } = useExtractionRecord(extractionId)
  const { data: extractionByDoc, refetch: refetchByDoc } = useExtractionByDocument(reviewId ? '' : id)
  const extraction = extractionById ?? extractionByDoc ?? null
  const refetchExtraction = () => { refetchById(); refetchByDoc() }

  async function handleProcess() {
    const result = await processDoc(id)
    if (result.success) {
      toast.success(
        result.status === 'review'
          ? 'Extraction complete — review required (low confidence)'
          : 'Extraction complete — data approved automatically'
      )
      refetch()
      refetchExtraction()
    } else {
      toast.error(result.error ?? 'Extraction failed')
    }
  }

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

  if (!doc || !doc.id) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Document not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/documents')}>
          Back to Documents
        </Button>
      </div>
    )
  }

  const canProcess = ['pending', 'failed'].includes(doc.status)
  const hasExtractionData = extraction || ['extracted', 'review_required', 'approved'].includes(doc.status)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="space-y-6">
        {/* Document header card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
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
                <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {doc.status.replace(/_/g, ' ')}
                </span>
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
              {canProcess && (
                <Button size="sm" onClick={handleProcess} disabled={isProcessing}>
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {isProcessing ? 'Processing...' : 'Extract Data'}
                </Button>
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
          <div className="grid grid-cols-3 gap-4 text-sm mt-6 pt-6 border-t border-gray-200">
            <div>
              <p className="text-gray-500 mb-1">Type</p>
              <p className="font-medium capitalize">{doc.doc_type?.replace(/_/g, ' ') ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Folder</p>
              <p className="font-medium capitalize">{doc.folder.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Size</p>
              <p className="font-medium">{formatBytes(doc.file_size)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Uploaded</p>
              <p className="font-medium">{formatDate(doc.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">MIME Type</p>
              <p className="font-medium">{doc.mime_type ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Extraction panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Extracted Data</h2>

          {!hasExtractionData && (
            <div className="text-center py-8 text-gray-500 text-sm">
              {doc.status === 'processing' ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Extracting data…
                </div>
              ) : (
                <>
                  <p>No extraction data yet.</p>
                  {canProcess && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleProcess}>
                      <Zap className="w-4 h-4 mr-2" />
                      Run Extraction
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {extraction && (
            <ExtractionForm
              record={extraction}
              onApproved={() => refetch()}
              onRejected={() => refetch()}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  extracted: 'bg-purple-100 text-purple-700',
  review_required: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
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
  })
}

export default function DocumentDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading...</div>}>
      <DocumentDetailContent />
    </Suspense>
  )
}
