import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/server', () => ({
  createServerSupabaseClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

import { createServerSupabaseClient } from '@/lib/db/server'
import {
  getPendingInvitations,
  createInvitation,
  revokeInvitation,
  acceptInvitation,
} from '../invitations'

const PENDING_ROW = {
  id: 'inv1',
  email: 'new@example.com',
  role: 'viewer',
  invited_by: 'u1',
  token: 'tok1',
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  accepted_at: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('getPendingInvitations', () => {
  it('returns pending invitations with correct shape', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [PENDING_ROW], error: null }),
              }),
            }),
          }),
        }),
      }),
    })
    const result = await getPendingInvitations('org1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'inv1',
      email: 'new@example.com',
      role: 'viewer',
      acceptedAt: null,
    })
  })
})

describe('createInvitation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws ALREADY_MEMBER when email is already in the org', async () => {
    let fromCall = 0
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        fromCall++
        if (fromCall === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'u99' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'm99' }, error: null }),
              }),
            }),
          }),
        }
      }),
    })
    await expect(createInvitation('org1', 'existing@example.com', 'viewer', 'u1'))
      .rejects.toThrow('ALREADY_MEMBER')
  })

  it('throws ALREADY_INVITED when a non-expired pending invite exists', async () => {
    let fromCall = 0
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockImplementation(() => {
        fromCall++
        if (fromCall === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'inv99' }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
      }),
    })
    await expect(createInvitation('org1', 'pending@example.com', 'viewer', 'u1'))
      .rejects.toThrow('ALREADY_INVITED')
  })
})

describe('acceptInvitation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws TOKEN_EXPIRED when invitation is expired', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...PENDING_ROW,
                expires_at: new Date(Date.now() - 1000).toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    })
    await expect(acceptInvitation('tok1', 'u2', 'new@example.com'))
      .rejects.toThrow('TOKEN_EXPIRED')
  })

  it('throws TOKEN_USED when invitation already accepted', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...PENDING_ROW, accepted_at: '2026-01-01T00:00:00Z' },
              error: null,
            }),
          }),
        }),
      }),
    })
    await expect(acceptInvitation('tok1', 'u2', 'new@example.com'))
      .rejects.toThrow('TOKEN_USED')
  })

  it('throws TOKEN_INVALID when token does not exist', async () => {
    ;(createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })
    await expect(acceptInvitation('bad-token', 'u2', 'x@x.com'))
      .rejects.toThrow('TOKEN_INVALID')
  })
})
