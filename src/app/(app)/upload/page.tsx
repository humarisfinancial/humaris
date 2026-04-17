'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Upload as UploadIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dropzone } from '@/components/upload/dropzone'
import { DuplicateReviewModal } from '@/components/upload/duplicate-review-modal'
import { Button } from '@/components/ui/button'
import { useUpload } from '@/hooks/use-documents'
import type { Document } from '@/types'

interface UploadResult {
  document: Document
  duplicates: Array<{
    matched_document: Document
    confidence: 'exact' | 'likely' | 'possible'
  }>
}

type UploadState = 'idle' | 'uploading' | 'reviewing' | 'done'

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [state, setState] = useState<UploadState>('idle')
  const [results, setResults] = useState<UploadResult[]>([])
  const [duplicatesToReview, setDuplicatesToReview] = useState<
    Array<{ document: Document; matched_document: Document; confidence: 'exact' | 'likely' | 'possible' }>
  >([])

  const { mutateAsync: upload } = useUpload()

  async function handleUpload() {
    if (!files.length) {
      toast.error('Please select at least one file')
      return
    }

    setState('uploading')

    try {
      const uploadResults = await upload(files)
      setResults(uploadResults)

      // Collect duplicates that need review
      const dupes = uploadResults
        .filter(r => r.duplicates.length > 0)
        .flatMap(r =>
          r.duplicates.map(d => ({
            document: r.document,
            matched_document: d.matched_document,
            confidence: d.confidence,
          }))
        )

      if (dupes.length > 0) {
        setDuplicatesToReview(dupes)
        setState('reviewing')
      } else {
        setState('done')
        const successCount = uploadResults.length
        toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded and organized successfully`)
      }
    } catch (err) {
      setState('idle')
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  function handleDuplicateReviewComplete() {
    setState('done')
    const dupeCount = duplicatesToReview.length
    const totalCount = results.length
    toast.success(`${totalCount} file${totalCount > 1 ? 's' : ''} uploaded successfully`)
    if (dupeCount > 0) {
      toast.info(`${dupeCount} file${dupeCount > 1 ? 's were' : ' was'} moved to Duplicates — Needs Review`)
    }
  }

  function handleReset() {
    setFiles([])
    setResults([])
    setDuplicatesToReview([])
    setState('idle')
  }

  return (
    <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Files</h1>
        <p className="text-gray-500 mt-1">
          Upload financial documents — they will be automatically renamed and organized
        </p>
      </div>

      {state === 'done' ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">
            {results.length} file{results.length > 1 ? 's' : ''} uploaded successfully
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            Files have been renamed, classified, and organized into your library.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="outline" onClick={handleReset}>
              Upload More
            </Button>
            <Button onClick={() => router.push('/documents')}>
              View Documents
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Rename notice */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Note:</strong> Your files will be renamed and standardized using the format:{' '}
            <code className="bg-amber-100 px-1 rounded">YYYY.MM.DD Document Type Vendor.ext</code>.
            Original files are always preserved in your archive.
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <Dropzone
              onFilesSelected={setFiles}
              disabled={state === 'uploading'}
            />
          </div>

          {files.length > 0 && (
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={state === 'uploading' || files.length === 0}
                className="min-w-32"
              >
                {state === 'uploading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="w-4 h-4 mr-2" />
                    Upload {files.length} File{files.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Duplicate review modal */}
      <DuplicateReviewModal
        open={state === 'reviewing'}
        duplicates={duplicatesToReview}
        onComplete={handleDuplicateReviewComplete}
      />
    </div>
  )
}
