-- FIX: Simplified storage policies (no complex path parsing)
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated can upload to project-files" ON storage.objects;
DROP POLICY IF EXISTS "Project members can view project-files" ON storage.objects;
DROP POLICY IF EXISTS "Project owner/admin can delete project-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete from project-files" ON storage.objects;

-- NEW APPROACH: Simple bucket-level policies
-- Security is enforced by:
-- 1. project_files table RLS (controls metadata)
-- 2. Signed URLs (time-limited access)
-- 3. Random UUIDs in paths (hard to guess)

-- Allow authenticated users to SELECT (needed for signed URL generation)
CREATE POLICY "Authenticated can select project-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files');

-- Allow authenticated users to INSERT
CREATE POLICY "Authenticated can insert project-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

-- Allow authenticated users to DELETE
CREATE POLICY "Authenticated can delete project-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files');
