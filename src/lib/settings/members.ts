import { createServerSupabaseClient } from '@/lib/db/server'
import type { OrgRole } from '@/types'

export interface OrgMember {
  id: string
  userId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: OrgRole
  joinedAt: string
}

export async function getMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('org_members')
    .select('id, role, created_at, user_profiles!inner(id, email, full_name, avatar_url)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: {
    id: string
    role: OrgRole
    created_at: string
    user_profiles: { id: string; email: string; full_name: string | null; avatar_url: string | null }
  }) => ({
    id: row.id,
    userId: row.user_profiles.id,
    email: row.user_profiles.email,
    fullName: row.user_profiles.full_name,
    avatarUrl: row.user_profiles.avatar_url,
    role: row.role,
    joinedAt: row.created_at,
  }))
}

export async function updateMemberRole(orgId: string, memberId: string, role: OrgRole): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('org_id', orgId)
    .eq('id', memberId)

  if (error) throw new Error(error.message)
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { data: member, error: memberError } = await supabase
    .from('org_members')
    .select('id, role')
    .eq('org_id', orgId)
    .eq('id', memberId)
    .single()

  if (memberError || !member) throw new Error('NOT_FOUND')

  if (member.role === 'owner') {
    const { count, error: countError } = await supabase
      .from('org_members')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('role', 'owner')

    if (countError) throw new Error(countError.message)
    if (count === 1) throw new Error('LAST_OWNER')
  }

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('org_id', orgId)
    .eq('id', memberId)

  if (error) throw new Error(error.message)
}
