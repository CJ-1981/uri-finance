-- Migration: Add transaction_id to project_files table
-- SPEC: SPEC-TRANSACTION-FILES
-- Created: 2026-03-21

-- Add transaction_id column (nullable foreign key)
ALTER TABLE public.project_files
ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Create index for efficient queries on transaction files
CREATE INDEX IF NOT EXISTS idx_project_files_transaction_id
ON public.project_files(transaction_id);

-- Create composite index for files in a specific project with optional transaction filter
CREATE INDEX IF NOT EXISTS idx_project_files_project_transaction
ON public.project_files(project_id, transaction_id);

-- Add comment for documentation
COMMENT ON COLUMN public.project_files.transaction_id IS
'Optional reference to transaction if file was uploaded via transaction modal.
Set to NULL when transaction is deleted (ON DELETE SET NULL).';
