import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'
import type { OrgRole } from '@/types'

export interface OrgInvitation {
  id: string
  email: string
  role: OrgRole
  invitedAt: string
  expiresAt: string
  acceptedAt: string | null
  token: string
}

export async function getPendingInvitations(orgId: string): Promise<OrgInvitation[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('org_invitations')
    .select('id, email, role, created_at, expires_at, accepted_at, token')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: {
    id: string; email: string; role: OrgRole; created_at: string
    expires_at: string; accepted_at: string | null; token: string
  }) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    invitedAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    token: row.token,
  }))
}

export async function createInvitation(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedBy: string
): Promise<OrgInvitation> {
  const supabase = await createServerSupabaseClient()

  // Check if email is already a member of this org
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (profile) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (membership) throw new Error('ALREADY_MEMBER')
  }

  // Check for existing non-expired pending invite
  const { data: existing } = await supabase
    .from('org_invitations')
    .select('id')
    .eq('org_id', orgId)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (existing) throw new Error('ALREADY_INVITED')

  // Create the invitation
  const { data, error } = await supabase
    .from('org_invitations')
    .insert({ org_id: orgId, email, role, invited_by: invitedBy })
    .select('id, email, role, created_at, expires_at, accepted_at, token')
    .single()

  if (error) throw new Error(error.message)
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    invitedAt: data.created_at,
    expiresAt: data.expires_at,
    acceptedAt: data.accepted_at,
    token: data.token,
  }
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('org_invitations')
    .delete()
    .eq('org_id', orgId)
    .eq('id', invitationId)

  if (error) throw new Error(error.message)
}

export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string
): Promise<{ orgId: string }> {
  const supabase = await createServerSupabaseClient()

  const { data: invitation, error } = await supabase
    .from('org_invitations')
    .select('id, org_id, email, role, invited_by, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!invitation) throw new Error('TOKEN_INVALID')
  if (invitation.accepted_at) throw new Error('TOKEN_USED')
  if (new Date(invitation.expires_at) < new Date()) throw new Error('TOKEN_EXPIRED')

  // Use service client to insert org_members (user isn't a member yet — no RLS access)
  const service = createServiceClient()

  const { error: memberError } = await service
    .from('org_members')
    .insert({
      org_id: invitation.org_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    })

  if (memberError) throw new Error(memberError.message)

  // Mark invitation accepted
  await supabase
    .from('org_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return { orgId: invitation.org_id }
}
