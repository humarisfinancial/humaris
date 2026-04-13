'use client'

import { useState } from 'react'
import { Mail, UserMinus, ChevronDown } from 'lucide-react'
import {
  useOrgMembers,
  useOrgInvitations,
  useUpdateMemberRole,
  useRemoveMember,
  useRevokeInvitation,
} from '@/hooks/use-settings'
import { InviteModal } from './invite-modal'
import type { OrgRole } from '@/types'

const ALL_ROLES: { value: OrgRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'ops', label: 'Ops' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
]

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner', admin: 'Admin', accountant: 'Accountant', ops: 'Ops', viewer: 'Viewer',
}

interface TeamTabProps {
  currentUserId: string
  currentUserRole: OrgRole
}

export function TeamTab({ currentUserId, currentUserRole }: TeamTabProps) {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const { data: membersData, isLoading: membersLoading } = useOrgMembers()
  const { data: invitationsData } = useOrgInvitations()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const revokeInvitation = useRevokeInvitation()

  const members = membersData?.members ?? []
  const invitations = invitationsData?.invitations ?? []

  const canManageUsers = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canManageOwnerRole = currentUserRole === 'owner'

  function canChangeRole(targetRole: OrgRole): boolean {
    if (!canManageUsers) return false
    if (targetRole === 'owner' || targetRole === 'admin') return canManageOwnerRole
    return true
  }

  function formatInvitedAgo(invitedAt: string): string {
    const ms = Date.now() - new Date(invitedAt).getTime()
    const days = Math.floor(ms / 86400000)
    if (days === 0) return 'today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Members ({members.length})
          </h2>
          {canManageUsers && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Invite Member
            </button>
          )}
        </div>

        {membersLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {members.map(member => {
              const isSelf = member.userId === currentUserId
              return (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-gray-600">
                    {(member.fullName ?? member.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.fullName ?? member.email}
                      </p>
                      {isSelf && (
                        <span className="text-xs text-gray-400 font-normal">You</span>
                      )}
                    </div>
                    {member.fullName && (
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                    )}
                  </div>
                  {canChangeRole(member.role) && !isSelf ? (
                    <div className="relative">
                      <select
                        value={member.role}
                        onChange={e => updateRole.mutate({ memberId: member.id, role: e.target.value as OrgRole })}
                        className="appearance-none pl-2 pr-6 py-1 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900 cursor-pointer"
                      >
                        {ALL_ROLES.filter(r => canManageOwnerRole || r.value !== 'owner').map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                    </div>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg">
                      {ROLE_LABELS[member.role]}
                    </span>
                  )}
                  {canManageUsers && !isSelf && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${member.fullName ?? member.email} from the organization?`)) {
                          removeMember.mutate(member.id)
                        }
                      }}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {invitations.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Pending Invitations ({invitations.length})
          </h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">Invited {formatInvitedAgo(inv.invitedAt)}</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg">
                  {ROLE_LABELS[inv.role]}
                </span>
                {canManageUsers && (
                  <button
                    onClick={() => revokeInvitation.mutate(inv.id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  )
}
