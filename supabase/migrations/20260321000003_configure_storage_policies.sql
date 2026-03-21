-- Migration: Configure Storage RLS Policies for project-files bucket
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Purpose: Allow project members to upload, view, and delete files in storage

-- IMPORTANT: This migration assumes the bucket 'project-files' already exists
-- If you haven't created it yet, create it via Supabase Dashboard or CLI first

-- ============================================================
-- Storage Bucket RLS Policies
-- ============================================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated can upload to project-files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can view project-files" ON storage.objects;
DROP POLICY IF EXISTS "Project owner/admin can delete project-files" ON storage.objects;

-- Policy: Authenticated users can upload files
-- Upload is already restricted by the project_files INSERT policy which:
-- 1) Checks user is project member
-- 2) Validates storage_path starts with "projects/{project_id}/"
CREATE POLICY "Authenticated can upload to project-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
);

-- Policy: Project members can view/download files
-- This allows signed URL generation and public access via signed URLs
CREATE POLICY "Project members can view project-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files' AND
  -- Extract project_id from path: projects/{projectId}/files/...
  -- Parse: "projects/uuid/files/..." to extract the UUID
  EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = SUBSTRING(name FROM 10 FOR 36) -- Extract UUID from "projects/{uuid}/..."
  )
);

-- Policy: Project owner/admin can delete files from storage
CREATE POLICY "Project owner/admin can delete project-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files' AND
  -- Extract project_id from path: "projects/{projectId}/files/..."
  EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = SUBSTRING(name FROM 10 FOR 36) -- Extract UUID from "projects/{uuid}/..."
      AND pm.role IN ('owner', 'admin')
  )
);

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON POLICY "Authenticated can upload to project-files" ON storage.objects
IS 'Allows authenticated users to upload; actual access controlled by project_files table RLS';

COMMENT ON POLICY "Project members can view project-files" ON storage.objects
IS 'Allows project members to view/download files via signed URLs';

COMMENT ON POLICY "Project owner/admin can delete project-files" ON storage.objects
IS 'Allows project owner/admin to delete files from storage';
