'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { OrgMember } from '@/lib/settings/members'
import type { OrgInvitation } from '@/lib/settings/invitations'
import type { OrgRole } from '@/types'

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function useOrgMembers() {
  return useQuery<{ members: OrgMember[] }>({
    queryKey: ['org-members'],
    queryFn: () => apiFetch('/api/settings/members'),
  })
}

export function useOrgInvitations() {
  return useQuery<{ invitations: OrgInvitation[] }>({
    queryKey: ['org-invitations'],
    queryFn: () => apiFetch('/api/settings/invitations'),
  })
}

export function useUpdateMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      apiFetch(`/api/settings/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/api/settings/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
  })
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrgRole }) =>
      apiFetch<{ invitation: OrgInvitation }>('/api/settings/invitations', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-invitations'] }),
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiFetch(`/api/settings/invitations/${invitationId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-invitations'] }),
  })
}

export function useUpdateOrg() {
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ name: string }>('/api/settings/org', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
  })
}
