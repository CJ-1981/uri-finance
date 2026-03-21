-- Migration: Create project_files table for file metadata
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Updated: 2026-03-21 - Added storage path validation

-- Create project_files table
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- CHECK constraint: Ensure storage_path is bound to project_id
  CONSTRAINT storage_path_bounded_to_project CHECK (storage_path LIKE 'projects/' || project_id || '/%')
);

-- Create indexes for efficient queries
CREATE INDEX project_files_project_id_idx ON public.project_files(project_id);
CREATE INDEX project_files_created_at_idx ON public.project_files(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Project members can view files
CREATE POLICY "Project members can view files"
ON public.project_files FOR SELECT
USING (public.is_project_member(auth.uid(), project_id));

-- RLS Policies: Project members can upload files
-- Validates: 1) User is project member, 2) uploaded_by matches user, 3) storage_path is prefixed with project_id
CREATE POLICY "Project members can upload files"
ON public.project_files FOR INSERT
WITH CHECK (
  public.is_project_member(auth.uid(), project_id) AND
  uploaded_by = auth.uid() AND
  -- Ensure storage_path starts with "projects/{project_id}/"
  storage_path ~ '^projects/' || project_id::text || '/%'
);

-- RLS Policies: Only project owner/admin can delete files
CREATE POLICY "Project owner/admin can delete files"
ON public.project_files FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = project_files.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'admin')
  )
);

-- Comment on table
COMMENT ON TABLE public.project_files IS 'Stores metadata for files uploaded to project storage buckets';
COMMENT ON COLUMN public.project_files.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN public.project_files.file_size IS 'File size in bytes';
COMMENT ON CONSTRAINT storage_path_bounded_to_project ON public.project_files IS 'Ensures storage_path is scoped to project_id';
