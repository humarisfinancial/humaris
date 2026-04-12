import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({ requireSession: vi.fn() }))
vi.mock('@/lib/settings/members', () => ({
  getMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}))

import { requireSession } from '@/lib/auth/session'
import { getMembers, updateMemberRole, removeMember } from '@/lib/settings/members'
import { GET } from '../route'
import { PATCH, DELETE } from '../[id]/route'

const ownerSession = { org: { id: 'org1' }, role: 'owner', id: 'u1', user: { id: 'u1' } }
const adminSession = { org: { id: 'org1' }, role: 'admin', id: 'u2', user: { id: 'u2' } }
const viewerSession = { org: { id: 'org1' }, role: 'viewer', id: 'u3', user: { id: 'u3' } }

const MEMBERS = [
  { id: 'm1', userId: 'u1', email: 'owner@org.com', fullName: 'Alice', avatarUrl: null, role: 'owner', joinedAt: '2026-01-01' },
]

describe('GET /api/settings/members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns members for admin+', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession)
    ;(getMembers as ReturnType<typeof vi.fn>).mockResolvedValue(MEMBERS)
    const res = await GET(new NextRequest('http://localhost/api/settings/members'))
    expect(res.status).toBe(200)
    expect((await res.json()).members).toHaveLength(1)
  })

  it('returns 403 for viewer', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(viewerSession)
    const res = await GET(new NextRequest('http://localhost/api/settings/members'))
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/settings/members/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when admin tries to set owner role', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession)
    const req = new NextRequest('http://localhost/api/settings/members/m1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'owner' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(403)
  })

  it('allows owner to change roles', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession)
    ;(updateMemberRole as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    const req = new NextRequest('http://localhost/api/settings/members/m2', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'm2' }) })
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/settings/members/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for viewer', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(viewerSession)
    const req = new NextRequest('http://localhost/api/settings/members/m1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 when removing last owner', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession)
    ;(removeMember as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LAST_OWNER'))
    const req = new NextRequest('http://localhost/api/settings/members/m1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Cannot remove the last owner')
  })
})
