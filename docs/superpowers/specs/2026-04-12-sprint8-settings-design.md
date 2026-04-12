# Sprint 8 — Settings & Team Management: Design Spec

**Date:** 2026-04-12
**Sprint:** 8 of 8
**Status:** Approved

---

## Overview

Sprint 8 builds the Settings page — the final placeholder in the platform. It delivers two tabs: **General** (update org name) and **Team** (view members, change roles, remove members, invite new members with pending state). Invitations use Supabase's built-in `auth.admin.inviteUserByEmail()` for email delivery, with a custom `org_invitations` table to track pending state and the invited role. A standalone `/invite/accept` page completes the acceptance flow.

---

## Scope

**In scope:**
- DB migration: `org_invitations` table
- `MembersRepository`: list, change role, remove (with last-owner guard)
- `InvitationsRepository`: create, revoke, accept (with expiry + duplicate guards)
- API routes: members CRUD, invitations CRUD, org name update, invite acceptance
- `/settings` page: tabbed (General | Team), tab preserved in URL
- General tab: org name form
- Team tab: member list with role dropdown + remove; pending invitations with revoke
- Invite modal: email + role selector
- `/invite/accept` standalone page (outside app shell)
- TanStack Query hooks: `useOrgMembers`, `useOrgInvitations`, `useUpdateOrg`

**Deferred:**
- Personal profile (name/avatar)
- SSO / SAML configuration
- Billing / subscription management
- Audit log
- API key management

---

## Architecture & Data Flow

### Option chosen: `org_invitations` table + Supabase Auth invite + `/invite/accept` route

Supabase handles email delivery via `auth.admin.inviteUserByEmail()`. The `org_invitations` record is created in the same API call (both succeed or neither is persisted). The invite email's `redirectTo` points to `/invite/accept?token=<uuid>`, which accepts the token, creates the `org_members` row, and redirects to `/dashboard`.

### DB Migration (`supabase/migrations/007_org_invitations.sql`)

```sql
CREATE TABLE IF NOT EXISTS org_invitations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        org_role NOT NULL,
  invited_by  uuid NOT NULL REFERENCES user_profiles(id),
  token       uuid NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON org_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token  ON org_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email  ON org_invitations(org_id, email);
```

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/007_org_invitations.sql` | New org_invitations table |
| Create | `src/lib/settings/members.ts` | MembersRepository |
| Create | `src/lib/settings/invitations.ts` | InvitationsRepository |
| Create | `src/lib/settings/__tests__/members.test.ts` | Unit tests for MembersRepository |
| Create | `src/lib/settings/__tests__/invitations.test.ts` | Unit tests for InvitationsRepository |
| Create | `src/hooks/use-settings.ts` | TanStack Query hooks |
| Create | `src/app/api/settings/members/route.ts` | GET members list |
| Create | `src/app/api/settings/members/[id]/route.ts` | PATCH role, DELETE member |
| Create | `src/app/api/settings/invitations/route.ts` | GET pending invites, POST new invite |
| Create | `src/app/api/settings/invitations/[id]/route.ts` | DELETE revoke invite |
| Create | `src/app/api/settings/org/route.ts` | PATCH org name |
| Create | `src/app/api/invite/accept/route.ts` | POST accept token |
| Create | `src/components/settings/general-tab.tsx` | Org name form |
| Create | `src/components/settings/team-tab.tsx` | Member list + pending invites |
| Create | `src/components/settings/invite-modal.tsx` | Email + role invite modal |
| Modify | `src/app/(app)/settings/page.tsx` | Replace placeholder with tabbed shell |
| Create | `src/app/invite/accept/page.tsx` | Standalone invite acceptance page |

---

## Data Repositories

### `MembersRepository` (`src/lib/settings/members.ts`)

```ts
export interface OrgMember {
  id: string          // org_members.id
  userId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: OrgRole
  joinedAt: string
}

export async function getMembers(orgId: string): Promise<OrgMember[]>
export async function updateMemberRole(orgId: string, memberId: string, role: OrgRole): Promise<void>
export async function removeMember(orgId: string, memberId: string): Promise<void>
// removeMember throws if the target is the last owner
```

### `InvitationsRepository` (`src/lib/settings/invitations.ts`)

```ts
export interface OrgInvitation {
  id: string
  email: string
  role: OrgRole
  invitedAt: string
  expiresAt: string
  acceptedAt: string | null
}

export async function getPendingInvitations(orgId: string): Promise<OrgInvitation[]>
// Returns invitations where accepted_at IS NULL AND expires_at > now()

export async function createInvitation(
  orgId: string, email: string, role: OrgRole, invitedBy: string
): Promise<OrgInvitation>
// Throws 'ALREADY_MEMBER' if email is in org_members
// Throws 'ALREADY_INVITED' if non-expired pending invite exists for this email+org

export async function revokeInvitation(orgId: string, invitationId: string): Promise<void>

export async function acceptInvitation(token: string): Promise<{ orgId: string }>
// Validates token: exists, not expired, not already accepted
// Sets accepted_at, inserts org_members row
// Throws 'TOKEN_INVALID', 'TOKEN_EXPIRED', 'TOKEN_USED'
```

---

## API Routes

### `GET /api/settings/members`
- Auth: `requireSession()` before try/catch
- Permission: `permissions.settings.viewOrg(role)`
- Returns: `{ members: OrgMember[] }`

### `PATCH /api/settings/members/[id]`
- Body: `{ role: OrgRole }`
- Permission: `permissions.settings.manageRoles(role)` for owner assignment; `permissions.settings.manageUsers(role)` for others
- Guard: cannot assign `owner` role unless current user is `owner`
- Returns: 200 on success; 403 if RBAC fails; 400 if last-owner conflict

### `DELETE /api/settings/members/[id]`
- Permission: `permissions.settings.manageUsers(role)`
- Guard: cannot remove last owner; cannot remove self
- Returns: 204 on success

### `GET /api/settings/invitations`
- Permission: `permissions.settings.manageUsers(role)`
- Returns: `{ invitations: OrgInvitation[] }`

### `POST /api/settings/invitations`
- Body: `{ email: string, role: OrgRole }`
- Permission: `permissions.settings.manageUsers(role)`
- Guard: cannot invite as `owner` (must be promoted after joining)
- Calls `createInvitation()` then `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })`
- If Supabase invite API fails: roll back DB record, return 502
- Returns: 201 `{ invitation: OrgInvitation }`
- Errors: 409 `{ error: 'Already a member' }` | `{ error: 'Invite already sent' }`

### `DELETE /api/settings/invitations/[id]`
- Permission: `permissions.settings.manageUsers(role)`
- Returns: 204

### `PATCH /api/settings/org`
- Body: `{ name: string }`
- Permission: `permissions.settings.configureFinancials(role)` (admin+)
- Validates: name 1–100 chars, not empty
- Returns: 200 `{ name: string }`

### `POST /api/invite/accept`
- Body: `{ token: string }`
- Auth: `requireSession()` — user must be authenticated (Supabase handles this before redirect)
- Calls `acceptInvitation(token)` — adds to org_members
- Returns: 200 `{ orgId: string }`
- Errors: 400 `{ error: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_USED' }`

---

## UI Components

### `/settings` page

Tabbed shell with URL-based tab state (`?tab=general` default, `?tab=team`). Tab switching uses `router.push` to keep URL in sync.

```
Settings
─────────────────────────────────
[General]  [Team]

< tab content >
```

RBAC: if the user lacks `settings.viewOrg`, redirect to `/dashboard`. The Team tab's invite button and role dropdowns are conditionally rendered based on `settings.manageUsers` and `settings.manageRoles`.

### General tab (`general-tab.tsx`)

```
Organization Name
[_____________________]
[Save]
```

Pre-filled from `session.org.name`. Save calls `PATCH /api/settings/org`. Shows inline success/error message.

### Team tab (`team-tab.tsx`)

**Members section:**
```
Members (N)                               [Invite Member]
────────────────────────────────────────────────────────
[AV]  Full Name        email@org.com    [Owner ▾]    [Remove]
[AV]  Jane Smith       jane@org.com     [Admin ▾]    [Remove]
[AV]  You (current)    me@org.com       [Viewer]
```
- Role dropdown shown only if current user has permission to change that role
- `owner` role cannot be set via invite; only via dropdown on an existing member
- Current user row has "You" badge; Remove button hidden for self

**Pending Invitations section** (shown only if pending invites exist):
```
Pending Invitations (N)
────────────────────────────────────────────────────────
[✉]  pending@example.com    Accountant    Invited 2d ago    [Revoke]
```

### Invite modal (`invite-modal.tsx`)

```
Invite team member
──────────────────
Email address
[_____________________]

Role
[Viewer ▾]   (options: Viewer, Ops, Accountant, Admin — no Owner)

[Cancel]  [Send Invite]
```

On success: modal closes, invitations list refreshes, brief toast "Invite sent to email@...".
On duplicate/error: inline error message inside the modal.

### `/invite/accept` page

Standalone — outside the `(app)` layout group, so no sidebar/nav. Minimal centered card.

**States:**
- **Loading:** "Accepting your invitation…" spinner
- **Success:** "Welcome to [Org Name]! Redirecting…" → redirects to `/dashboard`
- **Expired:** "This invitation has expired. Ask your team admin to send a new one."
- **Already used:** "This invitation has already been accepted. Try signing in."
- **Invalid token:** "Invalid invitation link."

---

## RBAC Summary

| Action | Minimum role |
|--------|-------------|
| View Settings / General tab | admin |
| View Team tab | admin |
| Invite members | admin |
| Remove members | admin |
| Change role (viewer/ops/accountant) | admin |
| Change role (admin/owner) | owner |
| Cannot invite as owner | — (blocked in API) |
| Cannot remove last owner | — (blocked in API) |
| Cannot remove self | — (blocked in API) |
| Update org name | admin |

---

## Edge Cases & Error Handling

| Scenario | Behaviour |
|---|---|
| Invite email already a member | 409 `{ error: 'Already a member' }` — shown in modal |
| Non-expired pending invite exists | 409 `{ error: 'Invite already sent' }` — shown in modal |
| Invite as owner | 403 `{ error: 'Cannot invite as owner' }` |
| Token expired | `/invite/accept` shows expiry message |
| Token already used | `/invite/accept` shows "already accepted" message |
| Supabase invite API fails | DB record rolled back; 502 error toast |
| Admin tries to promote to owner | 403 |
| Remove last owner | 400 `{ error: 'Cannot remove the last owner' }` |
| Remove self | 400 `{ error: 'Cannot remove yourself' }` |
| Org name empty / > 100 chars | 400 validation error inline |

---

## Testing

- **Unit:** `MembersRepository` — getMembers returns correct shape; updateMemberRole enforces last-owner guard; removeMember blocks removing last owner and self
- **Unit:** `InvitationsRepository` — createInvitation throws on duplicate member/invite; acceptInvitation validates expiry and reuse; getPendingInvitations excludes expired and accepted records
- **API:** Route tests for each endpoint — RBAC enforcement, validation errors, success responses
