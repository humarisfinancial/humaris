import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/server', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { createServerSupabaseClient } from '@/lib/db/server'
import { getMembers, updateMemberRole, removeMember } from '../members'

describe('getMembers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns members with correct OrgMember shape', async () => {
    const mockData = [
      {
        id: 'm1',
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        user_profiles: { id: 'u1', email: 'owner@example.com', full_name: 'Alice', avatar_url: null },
      },
    ]
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    })
    const members = await getMembers('org1')
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({
      id: 'm1',
      userId: 'u1',
      email: 'owner@example.com',
      fullName: 'Alice',
      role: 'owner',
    })
  })

  it('throws if Supabase returns an error', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    })
    await expect(getMembers('org1')).rejects.toThrow('DB error')
  })
})

describe('removeMember', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws LAST_OWNER when removing the only owner', async () => {
    let fromCall = 0
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        fromCall++
        if (fromCall === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'm1', role: 'owner' }, error: null }),
                }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
        }
      }),
    })
    await expect(removeMember('org1', 'm1')).rejects.toThrow('LAST_OWNER')
  })
})
