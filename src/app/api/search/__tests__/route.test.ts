import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/session', () => ({
  requireSession: vi.fn(),
}))

vi.mock('@/lib/search', () => ({
  postgresSearchProvider: { search: vi.fn() },
}))

import { requireSession } from '@/lib/auth/session'
import { postgresSearchProvider } from '@/lib/search'
import { GET } from '../route'

const mockSession = { org: { id: 'org1' }, role: 'owner', user: { id: 'u1' } }

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
    ;(postgresSearchProvider.search as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  it('returns 400 when q is missing', async () => {
    const req = new NextRequest('http://localhost/api/search')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('q is required')
  })

  it('returns 400 when q is shorter than 2 characters', async () => {
    const req = new NextRequest('http://localhost/api/search?q=a')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Query must be at least 2 characters')
  })

  it('returns results with correct shape for valid query', async () => {
    ;(postgresSearchProvider.search as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'd1', type: 'document', title: 'Invoice', subtitle: 'Invoices', url: '/documents/d1' },
    ])
    const req = new NextRequest('http://localhost/api/search?q=invoice')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.query).toBe('invoice')
  })

  it('truncates query to 100 characters before searching', async () => {
    const longQuery = 'a'.repeat(150)
    const req = new NextRequest(`http://localhost/api/search?q=${longQuery}`)
    await GET(req)
    expect(postgresSearchProvider.search).toHaveBeenCalledWith('a'.repeat(100), 'org1')
  })

  it('returns 500 and generic message on search error', async () => {
    ;(postgresSearchProvider.search as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'))
    const req = new NextRequest('http://localhost/api/search?q=test')
    const res = await GET(req)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Search failed')
  })

  it('returns 400 when session has no org context', async () => {
    ;(requireSession as ReturnType<typeof vi.fn>).mockResolvedValue({ org: null, role: 'owner', user: { id: 'u1' } })
    const req = new NextRequest('http://localhost/api/search?q=invoice')
    const res = await GET(req)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('No organization context')
  })
})
