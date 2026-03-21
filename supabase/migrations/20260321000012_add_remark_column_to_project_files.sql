-- Migration: Add remark column to project_files table
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

-- Add remark column for file descriptions/notes
ALTER TABLE public.project_files
ADD COLUMN IF NOT EXISTS remark TEXT;

-- Add comment for the new column
COMMENT ON COLUMN public.project_files.remark IS 'Optional description or notes for the uploaded file';
