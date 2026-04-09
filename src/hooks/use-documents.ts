'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { DocumentFolder, DuplicateResolution, PaginatedResult, Document } from '@/types'

// ── Document list ──────────────────────────────────────────

interface UseDocumentsOptions {
  folder?: DocumentFolder
  search?: string
  page?: number
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const params = new URLSearchParams()
  if (options.folder) params.set('folder', options.folder)
  if (options.search) params.set('search', options.search)
  if (options.page) params.set('page', String(options.page))

  return useQuery<PaginatedResult<Document>>({
    queryKey: ['documents', options],
    queryFn: () =>
      fetch(`/api/documents?${params.toString()}`).then(r => r.json()),
  })
}

// ── Pending duplicates count ────────────────────────────────

export function usePendingDuplicatesCount() {
  return useQuery<number>({
    queryKey: ['duplicates', 'count'],
    queryFn: () =>
      fetch('/api/documents/duplicates')
        .then(r => r.json())
        .then(d => d.total ?? 0),
    refetchInterval: 60_000, // re-check every minute
  })
}

// ── Pending duplicates list ────────────────────────────────

export function usePendingDuplicates() {
  return useQuery({
    queryKey: ['duplicates', 'pending'],
    queryFn: () =>
      fetch('/api/documents/duplicates').then(r => r.json()),
  })
}

// ── Resolve duplicate ──────────────────────────────────────

export function useResolveDuplicate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: { flag_id: string; resolution: DuplicateResolution }) =>
      fetch('/api/documents/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// ── Upload ─────────────────────────────────────────────────

interface UploadResult {
  document: Document
  duplicates: Array<{
    matched_document: Document
    confidence: 'exact' | 'likely' | 'possible'
  }>
}

export function useUpload() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (files: File[]): Promise<UploadResult[]> => {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      return json.results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['duplicates'] })
    },
  })
}

// ── Delete document ────────────────────────────────────────

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/documents/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
