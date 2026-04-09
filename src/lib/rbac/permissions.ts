import type { OrgRole } from '@/types'

/**
 * Permission matrix — defines what each role can do.
 * Single source of truth for all access control decisions.
 */

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 5,
  admin: 4,
  accountant: 3,
  ops: 2,
  viewer: 1,
}

export function hasMinRole(userRole: OrgRole, minRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

export const permissions = {
  // Document permissions
  documents: {
    upload: (role: OrgRole) => hasMinRole(role, 'ops'),
    view: (role: OrgRole) => hasMinRole(role, 'viewer'),
    edit: (role: OrgRole) => hasMinRole(role, 'accountant'),
    delete: (role: OrgRole) => hasMinRole(role, 'admin'),
    resolveDuplicate: (role: OrgRole) => hasMinRole(role, 'ops'),
  },

  // Extraction permissions
  extraction: {
    view: (role: OrgRole) => hasMinRole(role, 'ops'),
    review: (role: OrgRole) => hasMinRole(role, 'accountant'),
    edit: (role: OrgRole) => hasMinRole(role, 'accountant'),
  },

  // Ledger permissions
  ledger: {
    view: (role: OrgRole) => hasMinRole(role, 'accountant'),
    create: (role: OrgRole) => hasMinRole(role, 'accountant'),
    edit: (role: OrgRole) => hasMinRole(role, 'accountant'),
    delete: (role: OrgRole) => hasMinRole(role, 'admin'),
  },

  // Financial statements
  statements: {
    view: (role: OrgRole) => hasMinRole(role, 'viewer'),
    generate: (role: OrgRole) => hasMinRole(role, 'accountant'),
    export: (role: OrgRole) => hasMinRole(role, 'accountant'),
  },

  // Dashboard
  dashboard: {
    view: (role: OrgRole) => hasMinRole(role, 'viewer'),
    viewFull: (role: OrgRole) => hasMinRole(role, 'accountant'),
  },

  // Search
  search: {
    use: (role: OrgRole) => hasMinRole(role, 'viewer'),
  },

  // Settings / user management
  settings: {
    viewOrg: (role: OrgRole) => hasMinRole(role, 'admin'),
    manageUsers: (role: OrgRole) => hasMinRole(role, 'admin'),
    manageRoles: (role: OrgRole) => hasMinRole(role, 'owner'),
    configureFinancials: (role: OrgRole) => hasMinRole(role, 'admin'),
    manageIntegrations: (role: OrgRole) => hasMinRole(role, 'owner'),
  },
} as const

export type PermissionKey = keyof typeof permissions
