# Sprint 4 — Internal Ledger Engine: Context & Decisions

> Completed: 2026-04-07

---

## What Was Built

### Repositories

**`src/lib/db/repositories/ledger-repository.ts`**
Key methods:
- `create(input)` — create a ledger entry, returns with joined account
- `createFromExtraction(orgId, extractedRecordId, docId, amount, accountId, entryDate, description, createdBy)` — convenience wrapper
- `findById(id, orgId)` — single entry with account join
- `list(orgId, filters, pagination)` — filterable by account_id, date range, is_manual; paginated
- `update(id, orgId, updates)` — partial update
- `delete(id, orgId)` — hard delete
- `getAccountBalances(orgId, dateFrom?, dateTo?)` — aggregates debit/credit totals per account; returns `AccountBalance[]`

**`src/lib/db/repositories/chart-of-accounts-repository.ts`**
Key methods:
- `list(orgId)` — all accounts ordered by code
- `findById(id, orgId)`
- `findByType(orgId, type)`
- `create(input)` — new custom account
- `update(id, orgId, updates)` — name/type/parent only
- `delete(id, orgId)` — blocks system accounts (`is_system = true`)
- `seedDefaults(orgId)` — calls `seed_default_chart_of_accounts(p_org_id)` DB function
- `countForOrg(orgId)` — used to detect first-time setup

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ledger` | GET | List entries (filterable: account_id, date_from, date_to, is_manual) |
| `/api/ledger` | POST | Create manual entry (debit XOR credit validated server-side) |
| `/api/ledger/[id]` | GET | Get single entry |
| `/api/ledger/[id]` | PATCH | Update entry |
| `/api/ledger/[id]` | DELETE | Delete entry (admin only) |
| `/api/ledger/accounts` | GET | List chart of accounts (auto-seeds defaults on first call) |
| `/api/ledger/accounts` | POST | Create custom account |
| `/api/ledger/accounts/[id]` | PATCH | Update account |
| `/api/ledger/accounts/[id]` | DELETE | Delete account (blocks system accounts) |
| `/api/ledger/balances` | GET | Account balance rollup (filterable by date range) |

### Auto-seed on First Access
`GET /api/ledger/accounts` checks `countForOrg()` and calls `seedDefaults()` if count = 0. No migration needed — defaults are seeded lazily on first page load.

### Hooks (`src/hooks/use-ledger.ts`)
`useLedgerEntries`, `useLedgerEntry`, `useCreateLedgerEntry`, `useUpdateLedgerEntry`, `useDeleteLedgerEntry`, `useChartOfAccounts`, `useCreateAccount`, `useUpdateAccount`, `useDeleteAccount`, `useAccountBalances`

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LedgerTable` | `src/components/ledger/ledger-table.tsx` | Filterable, sortable, paginated entries table with inline edit/delete |
| `EntryForm` | `src/components/ledger/entry-form.tsx` | Create/edit manual entry — debit/credit toggle, account picker grouped by type |
| `AccountManager` | `src/components/ledger/account-manager.tsx` | Chart of accounts viewer/editor — create custom accounts, edit names/types, delete non-system |

### Page — `/ledger`
- Summary cards: Total Revenue, Total Expenses, Net Income (live from `getAccountBalances`)
- Tab 1: **Entries** — full `LedgerTable` with filters + pagination
- Tab 2: **Chart of Accounts** — `AccountManager`
- "New Entry" button → `EntryForm` in dialog

### Auto-Ledger on Approval
**`src/app/api/extraction/[id]/approve/route.ts`** — after approving an extraction, automatically creates a ledger entry if `record.amount > 0`:
- Maps doc type → default account code (invoice → 2010 AP, receipt → 6900 Other Expenses, payroll → 6010, revenue → 4010, bank_statement → 1020)
- Uses `ChartOfAccountsRepository.list()` to resolve account ID
- Revenue accounts → credit entry; all others → debit entry
- Non-fatal: failure logs a warning but does not block approval

---

## Double-Entry Validation

Enforced at two layers:
1. **DB constraint** (from Sprint 1 migration): `(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)` — prevents invalid entries at the DB level
2. **API layer** (POST/PATCH /api/ledger): validates before inserting — returns 400 if both > 0 or both = 0

---

## Account Balance Calculation

`getAccountBalances()` queries all `ledger_entries` for the org (optionally date-filtered), aggregates in memory per account, and returns:
```typescript
interface AccountBalance {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total_debit: number
  total_credit: number
  balance: number  // total_debit - total_credit
}
```

Net Income on the Ledger page = (sum of revenue balances) - (sum of expense balances).

---

## Known Gaps / Sprint 5 Handoff

1. **No transaction ↔ document link in UI** — `source_doc_id` is stored but the Ledger table doesn't show a link to the source document. Sprint 5+ should add a clickable link.

2. **Account balance page** — there's no dedicated balance sheet / trial balance UI yet. Sprint 5 will build the Financial Statement Generator which covers this.

3. **Running balance per account** — the current balance is a total, not a running balance over time. A proper account ledger view with running balance column would improve usability.

4. **Chart of accounts seeding is lazy** — first call to `GET /api/ledger/accounts` triggers the seed. This is fine for MVP but for production, seed on org creation (add `seed_default_chart_of_accounts()` call to the org signup handler).

5. **Category field is free-text** — no taxonomy enforcement. Sprint 5 could replace this with a controlled vocabulary or link to account codes.

6. **No multi-entry transaction batching** — each form creates one debit or credit line. Double-entry ideally creates matching pairs (e.g. debit Expenses + credit Accounts Payable). This is deferred to a future "journal entry" UI.

---

## New shadcn Components Added (Sprint 4)

- `select` — `src/components/ui/select.tsx`
- `textarea` — `src/components/ui/textarea.tsx`

---

## Next: Sprint 5 — Financial Statement Generator

Picks up from here. Needs:
- P&L (Income Statement) — Revenue - Expenses by period
- Balance Sheet — Assets vs Liabilities + Equity
- Cash Flow Statement — from ledger entries
- Period selector (monthly, quarterly, yearly)
- Statement export (PDF/CSV)
- `/templates` page integration
