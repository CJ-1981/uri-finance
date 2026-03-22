-- Migration: Add UPDATE policy for project_files table
-- SPEC: SPEC-TRANSACTION-FILES
-- Created: 2026-03-22
-- Description: Allows project members to update file metadata (transaction_id, remark)
-- This is needed for unlinking files from deleted transactions

-- Drop existing UPDATE policy if any
DROP POLICY IF EXISTS "Project members can update files" ON public.project_files;

-- RLS Policy: Project members can update file metadata (transaction_id, remark)
-- This allows unlinking files from transactions when transactions are deleted
CREATE POLICY "Project members can update files"
ON public.project_files FOR UPDATE
USING (public.is_project_member(auth.uid(), project_id))
WITH CHECK (
  public.is_project_member(auth.uid(), project_id)
);

-- Add comment for documentation
COMMENT ON POLICY "Project members can update files" ON public.project_files IS
'Allows project members to update file metadata including transaction_id and remark. Required for unlinking files from deleted transactions.';
