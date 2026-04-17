-- Add 'rejected' to the document_status enum
-- This allows documents to be marked as rejected when their extraction is rejected by a reviewer.

ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'rejected';
