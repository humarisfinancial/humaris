-- Sprint 8: org_invitations table for tracking pending team invitations.
-- Invitations expire after 72 hours. accepted_at = NULL means pending.

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

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id
  ON org_invitations(org_id);

CREATE INDEX IF NOT EXISTS idx_org_invitations_token
  ON org_invitations(token);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email
  ON org_invitations(org_id, email);
