import { NextResponse, type NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { permissions } from '@/lib/rbac/permissions'
import { ChartOfAccountsRepository } from '@/lib/db/repositories/chart-of-accounts-repository'
import type { AccountType } from '@/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await requireSession()
    if (!permissions.ledger.view(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Seed defaults if none exist yet
    const count = await ChartOfAccountsRepository.countForOrg(session.org.id)
    if (count === 0) {
      await ChartOfAccountsRepository.seedDefaults(session.org.id)
    }

    const accounts = await ChartOfAccountsRepository.list(session.org.id)
    return NextResponse.json({ accounts })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!permissions.ledger.create(session.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { code, name, type, parent_id } = body

    if (!code || !name || !type) {
      return NextResponse.json({ error: 'code, name, and type are required' }, { status: 400 })
    }

    const validTypes: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })
    }

    const account = await ChartOfAccountsRepository.create({
      org_id: session.org.id,
      code,
      name,
      type,
      parent_id: parent_id ?? null,
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create account' },
      { status: 500 }
    )
  }
}
