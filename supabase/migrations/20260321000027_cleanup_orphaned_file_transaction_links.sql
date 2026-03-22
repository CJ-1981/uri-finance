-- Migration: Clean up orphaned transaction links in project_files
-- SPEC: SPEC-TRANSACTION-FILES
-- Created: 2026-03-21
-- Description: Unlink files from soft-deleted transactions to prevent showing invalid links

-- Unlink files from soft-deleted transactions
-- When a transaction is soft deleted (deleted_at is not null), its associated files
-- should have transaction_id set to NULL to avoid showing broken links
UPDATE public.project_files
SET transaction_id = NULL
WHERE transaction_id IN (
  SELECT id FROM public.transactions WHERE deleted_at IS NOT NULL
);

-- Add comment for documentation
COMMENT ON COLUMN public.project_files.transaction_id IS
'Optional reference to transaction if file was uploaded via transaction modal.
Set to NULL when transaction is deleted (soft delete or ON DELETE SET NULL).
This is maintained by the application logic when deleting transactions.';
