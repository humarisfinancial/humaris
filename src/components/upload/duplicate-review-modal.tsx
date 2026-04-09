'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useResolveDuplicate } from '@/hooks/use-documents'
import { toast } from 'sonner'
import type { Document, DuplicateResolution } from '@/types'

interface DuplicateItem {
  flag_id?: string
  document: Document
  matched_document: Document
  confidence: 'exact' | 'likely' | 'possible'
}

interface DuplicateReviewModalProps {
  duplicates: DuplicateItem[]
  open: boolean
  onComplete: () => void
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  exact: { label: 'Exact Match', color: 'bg-red-100 text-red-700' },
  likely: { label: 'Likely Duplicate', color: 'bg-yellow-100 text-yellow-700' },
  possible: { label: 'Possible Duplicate', color: 'bg-blue-100 text-blue-700' },
}

const RESOLUTION_OPTIONS: { value: DuplicateResolution; label: string; description: string }[] = [
  { value: 'keep_new', label: 'Keep New', description: 'Replace existing file with the uploaded version' },
  { value: 'keep_existing', label: 'Keep Existing', description: 'Discard the uploaded file, keep existing' },
  { value: 'keep_both', label: 'Keep Both', description: 'Keep both files (new will be versioned as v2)' },
  { value: 'decide_later', label: 'Decide Later', description: 'Move to /Duplicates — Needs Review' },
]

export function DuplicateReviewModal({ duplicates, open, onComplete }: DuplicateReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [resolutions, setResolutions] = useState<Record<number, DuplicateResolution>>({})
  const { mutateAsync: resolve, isPending } = useResolveDuplicate()

  const current = duplicates[currentIndex]
  const isLast = currentIndex === duplicates.length - 1
  const confidence = current ? CONFIDENCE_LABELS[current.confidence] : null

  const handleSelect = (resolution: DuplicateResolution) => {
    setResolutions(prev => ({ ...prev, [currentIndex]: resolution }))
  }

  const handleNext = async () => {
    const resolution = resolutions[currentIndex]
    if (!resolution) {
      toast.error('Please select an action before continuing')
      return
    }

    if (current.flag_id) {
      try {
        await resolve({ flag_id: current.flag_id, resolution })
      } catch {
        toast.error('Failed to save resolution')
        return
      }
    }

    if (isLast) {
      onComplete()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  if (!current) return null

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <DialogTitle>Duplicate File Detected</DialogTitle>
          </div>
          <DialogDescription>
            File {currentIndex + 1} of {duplicates.length} — review and choose how to handle this
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Confidence badge */}
          {confidence && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${confidence.color}`}>
              {confidence.label}
            </span>
          )}

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Uploaded File</p>
              <p className="text-sm font-medium text-gray-900 break-all">{current.document.original_name}</p>
              <p className="text-xs text-gray-500 mt-1">{formatBytes(current.document.file_size)}</p>
              <p className="text-xs text-gray-500">{formatDate(current.document.created_at)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Existing File</p>
              <p className="text-sm font-medium text-gray-900 break-all">
                {current.matched_document.renamed_name ?? current.matched_document.original_name}
              </p>
              <p className="text-xs text-gray-500 mt-1">{formatBytes(current.matched_document.file_size)}</p>
              <p className="text-xs text-gray-500">{formatDate(current.matched_document.created_at)}</p>
            </div>
          </div>

          {/* Resolution options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Choose an action:</p>
            {RESOLUTION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  resolutions[currentIndex] === opt.value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  resolutions[currentIndex] === opt.value
                    ? 'border-gray-900 bg-gray-900'
                    : 'border-gray-400'
                }`}>
                  {resolutions[currentIndex] === opt.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <div className="flex gap-1">
              {duplicates.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < currentIndex
                      ? 'bg-green-500'
                      : i === currentIndex
                      ? 'bg-gray-900'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <Button onClick={handleNext} disabled={isPending || !resolutions[currentIndex]}>
              {isPending ? 'Saving...' : isLast ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Done
                </span>
              ) : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}
