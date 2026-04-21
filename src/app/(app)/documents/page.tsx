'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Upload, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderNav } from '@/components/documents/folder-nav'
import { DocumentTable } from '@/components/documents/document-table'
import { useDocuments } from '@/hooks/use-documents'
import type { DocumentFolder } from '@/types'

const FOLDER_MIN = 28
const FOLDER_DEFAULT = 180
const FOLDER_MAX = 320
const FOLDER_COLLAPSE_THRESHOLD = 60

function DocumentsContent() {
  const searchParams = useSearchParams()
  const folder = (searchParams.get('folder') as DocumentFolder | null) ?? undefined
  const [search, setSearch] = useState('')
  const [folderWidth, setFolderWidth] = useState(FOLDER_DEFAULT)

  useEffect(() => {
    const saved = localStorage.getItem('documents:folderWidth')
    if (saved) setFolderWidth(Math.max(FOLDER_MIN, Math.min(FOLDER_MAX, Number(saved))))
  }, [])

  const isCollapsed = folderWidth <= FOLDER_COLLAPSE_THRESHOLD

  function toggleFolder() {
    const next = isCollapsed ? FOLDER_DEFAULT : FOLDER_MIN
    setFolderWidth(next)
    localStorage.setItem('documents:folderWidth', String(next))
  }

  // Drag-to-resize
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startW.current = folderWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [folderWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const newW = Math.max(FOLDER_MIN, Math.min(FOLDER_MAX, startW.current + (e.clientX - startX.current)))
      setFolderWidth(newW)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setFolderWidth(prev => {
        localStorage.setItem('documents:folderWidth', String(prev))
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const { data, isLoading } = useDocuments({ folder, search: search || undefined })

  return (
    <div className="flex gap-0 h-full">
      {/* Folder sidebar with drag resize */}
      <aside
        className="hidden sm:flex flex-col shrink-0 relative overflow-visible"
        style={{ width: folderWidth }}
      >
        <div className="overflow-hidden h-full pr-4" style={{ width: folderWidth }}>
          {!isCollapsed && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</p>
                <button onClick={toggleFolder} title="Collapse" className="p-0.5 text-gray-400 hover:text-gray-700 rounded transition-colors">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <FolderNav />
            </>
          )}
          {isCollapsed && (
            <button onClick={toggleFolder} title="Expand folders" className="mt-0.5 p-1 text-gray-400 hover:text-gray-700 rounded transition-colors">
              <PanelLeftOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Drag handle on right edge */}
        <div
          onMouseDown={handleDragStart}
          onDoubleClick={() => {
            setFolderWidth(FOLDER_DEFAULT)
            localStorage.setItem('documents:folderWidth', String(FOLDER_DEFAULT))
          }}
          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize group z-10"
          title="Drag to resize · Double-click to reset"
        >
          <div className="absolute right-1 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400 transition-colors" />
        </div>
      </aside>

      {/* Gap between sidebar and content */}
      <div className="w-4 shrink-0" />

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search documents..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Link href="/upload">
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </Link>
        </div>

        {/* Folder picker — visible only when sidebar is hidden (small screens) */}
        <div className="sm:hidden">
          <select
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
            value={folder ?? 'all'}
            onChange={e => {
              const val = e.target.value
              window.location.href = val === 'all' ? '/documents' : `/documents?folder=${val}`
            }}
          >
            <option value="all">All Documents</option>
            <option value="invoices">Invoices</option>
            <option value="expenses">Expenses</option>
            <option value="revenue">Revenue</option>
            <option value="inventory">Inventory</option>
            <option value="bank_statements">Bank Statements</option>
            <option value="payroll">Payroll</option>
            <option value="finance_accounting">Finance &amp; Accounting</option>
            <option value="original_uploads">Original Uploads</option>
            <option value="duplicates_review">Duplicates Review</option>
          </select>
        </div>

        {/* Stats row */}
        {data && (
          <p className="text-sm text-gray-500">
            {data.total} document{data.total !== 1 ? 's' : ''}
            {folder ? ` in ${folder.replace(/_/g, ' ')}` : ''}
          </p>
        )}

        <DocumentTable
          documents={data?.items ?? []}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <div className="w-full px-3 sm:px-5 lg:px-8 py-4 sm:py-6 h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 mt-1">Your organized financial document library</p>
      </div>
      <Suspense fallback={<div className="text-gray-400 text-sm">Loading...</div>}>
        <DocumentsContent />
      </Suspense>
    </div>
  )
}
