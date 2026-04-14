-- Sprint 7: Add generated tsvector columns for full-text search.
-- These are auto-maintained by Postgres on every insert/update.
-- No separate indexing pipeline required.
--
-- Note: to_tsvector() is STABLE, not IMMUTABLE. Generated columns require
-- IMMUTABLE expressions, so we wrap it in a helper function.

CREATE OR REPLACE FUNCTION tsvector_immutable(text)
RETURNS tsvector LANGUAGE sql IMMUTABLE AS
$$ SELECT to_tsvector('pg_catalog.english', $1) $$;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    tsvector_immutable(
      coalesce(renamed_name, '') || ' ' ||
      coalesce(original_name, '') || ' ' ||
      coalesce(doc_type::text, '') || ' ' ||
      coalesce(folder::text, ''))
  ) STORED;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    tsvector_immutable(
      coalesce(description, '') || ' ' ||
      coalesce(category, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_search_vector
  ON ledger_entries USING gin(search_vector);
