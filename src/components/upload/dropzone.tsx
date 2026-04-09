'use client'

import { useCallback, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx,.doc,.docx'

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export function Dropzone({ onFilesSelected, disabled }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f => ACCEPTED_TYPES.includes(f.type))
    setSelectedFiles(prev => {
      const merged = [...prev, ...valid]
      onFilesSelected(merged)
      return merged
    })
  }, [onFilesSelected])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const next = prev.filter((_, i) => i !== index)
      onFilesSelected(next)
      return next
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    addFiles(files)
  }, [addFiles, disabled])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Drop area */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-gray-900 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={onInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-4" />
        <p className="text-base font-medium text-gray-700">
          Drag & drop files here, or <span className="text-gray-900 underline">browse</span>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          PDF, JPG, PNG, CSV, XLS, XLSX, DOC, DOCX — up to 50MB each
        </p>
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
          </p>
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg"
            >
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
