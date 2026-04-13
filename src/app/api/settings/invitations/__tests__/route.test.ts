import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({ requireSession: vi.fn() }))
vi.mock('@/lib/settings/invitations', () => ({
  getPendingInvitations: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}))
vi.mock('@/lib/db/server', () => ({
  createServiceClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}))

import { requireSession } from '@/lib/auth/session'
import { getPendingInvitations, createInvitation, revokeInvitation } from '@/lib/settings/invitations'
import { createServiceClient } from '@/lib/db/server'
import { GET, POST } from '../route'
import { DELETE } from '../[id]/route'

const adminSession = { org: { id: 'org1', name: 'Acme' }, role: 'admin', id: 'u1', user: { id: 'u1' } }
const viewerSession = { org: { id: 'org1' }, role: 'viewer', id: 'u2', user: { id: 'u2' } }

const INVITATION = {
  id: 'inv1', email: 'new@example.com', role: 'viewer',
  invitedAt: '2026-01-01', expiresAt: '2026-01-04', acceptedAt: null, token: 'tok1',
}

describe('GET /api/settings/invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pending invitations for admin+', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    ;(getPendingInvitations as ReturnType<typeof vi.fn>).mockResolvedValue([INVITATION])
    const res = await GET(new NextRequest('http://localhost/api/settings/invitations'))
    expect(res.status).toBe(200)
    expect((await res.json()).invitations).toHaveLength(1)
  })

  it('returns 403 for viewer', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(viewerSession)
    const res = await GET(new NextRequest('http://localhost/api/settings/invitations'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/settings/invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 and calls Supabase invite on success', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    ;(createInvitation as ReturnType<typeof vi.fn>).mockResolvedValue(INVITATION)
    ;(createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { admin: { inviteUserByEmail: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
    })
    const req = new NextRequest('http://localhost/api/settings/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', role: 'viewer' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect((await res.json()).invitation.email).toBe('new@example.com')
  })

  it('returns 403 when trying to invite as owner', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    const req = new NextRequest('http://localhost/api/settings/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', role: 'owner' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 409 when email is already a member', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    ;(createInvitation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ALREADY_MEMBER'))
    const req = new NextRequest('http://localhost/api/settings/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: 'existing@example.com', role: 'viewer' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Already a member')
  })

  it('returns 409 when invite already sent', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    ;(createInvitation as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ALREADY_INVITED'))
    const req = new NextRequest('http://localhost/api/settings/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: 'pending@example.com', role: 'viewer' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Invite already sent')
  })
})

describe('DELETE /api/settings/invitations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 on successful revoke', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    ;(revokeInvitation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const req = new NextRequest('http://localhost/api/settings/invitations/inv1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'inv1' }) })
    expect(res.status).toBe(204)
  })
})
