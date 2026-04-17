'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ExtractedRecord, PaginatedResult } from '@/types'

export function useExtractionRecord(id: string) {
  return useQuery<ExtractedRecord>({
    queryKey: ['extraction', id],
    queryFn: () => fetch(`/api/extraction/${id}`).then(r => r.json()),
    enabled: !!id,
  })
}

export function useExtractionByDocument(documentId: string) {
  return useQuery<ExtractedRecord | null>({
    queryKey: ['extraction', 'by-doc', documentId],
    queryFn: () =>
      fetch(`/api/extraction/document/${documentId}`).then(r => r.json()),
    enabled: !!documentId,
  })
}

export function useReviewQueue(page = 1) {
  return useQuery<PaginatedResult<ExtractedRecord>>({
    queryKey: ['extraction', 'review', page],
    queryFn: () => fetch(`/api/extraction/review?page=${page}`).then(r => r.json()),
  })
}

export function useReviewQueueCount() {
  return useQuery<number>({
    queryKey: ['extraction', 'review', 'count'],
    queryFn: () =>
      fetch('/api/extraction/review').then(r => r.json()).then(d => d.total ?? 0),
    refetchInterval: 60_000,
  })
}

export function useProcessDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      fetch(`/api/extraction/process/${documentId}`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['extraction'] })
    },
  })
}

export function useUpdateExtraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExtractedRecord> }) =>
      fetch(`/api/extraction/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(r => r.json()),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['extraction', id] })
      queryClient.invalidateQueries({ queryKey: ['extraction', 'review'] })
    },
  })
}

export function useApproveExtraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/extraction/${id}/approve`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to approve')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extraction'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document'] })
    },
  })
}

export function useRejectExtraction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/extraction/${id}/reject`, { method: 'POST' })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to reject')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extraction'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['document'] })
    },
  })
}
