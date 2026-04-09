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
      {/* Folder sidebar */}
      <aside className="w-52 shrink-0">
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
    <div className="p-8 h-full">
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
