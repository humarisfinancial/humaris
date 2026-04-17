'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Upload, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderNav } from '@/components/documents/folder-nav'
import { DocumentTable } from '@/components/documents/document-table'
import { useDocuments } from '@/hooks/use-documents'
import type { DocumentFolder } from '@/types'

function DocumentsContent() {
  const searchParams = useSearchParams()
  const folder = (searchParams.get('folder') as DocumentFolder | null) ?? undefined
  const [search, setSearch] = useState('')

  const { data, isLoading } = useDocuments({ folder, search: search || undefined })

  return (
    <div className="flex gap-6 h-full">
      {/* Folder sidebar — hidden at small widths */}
      <aside className="hidden sm:block w-44 lg:w-52 shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Folders</p>
        <FolderNav />
      </aside>

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
