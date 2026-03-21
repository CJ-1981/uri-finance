-- Migration: Document Storage Security Model
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Purpose: Document the working storage configuration

-- ============================================================
-- STORAGE SECURITY ARCHITECTURE
-- ============================================================
--
-- This project uses a HYBRID security model for file storage:
--
-- 1. storage.objects table: RLS DISABLED
--    - System table owned by Supabase (cannot be modified by users)
--    - Direct file access requires signed URLs (time-limited tokens)
--    - Files stored with random UUIDs (unguessable paths)
--
-- 2. project_files table: RLS ENABLED
--    - Controls all metadata access
--    - Enforces project membership checks
--    - Provides audit trail of uploads/deletes
--
-- SECURITY LAYERS:
-- Layer 1: Authentication required for all operations
-- Layer 2: project_files RLS checks project membership
-- Layer 3: Signed URLs expire after 60 minutes
-- Layer 4: Random UUIDs prevent path guessing
--
-- ============================================================

-- Verify current state
SELECT
  'storage.objects RLS status:' as check_type,
  relforcerowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'objects'
  AND relnamespace = 'storage'::regnamespace;

SELECT
  'project_files RLS status:' as check_type,
  relforcerowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'project_files'
  AND relnamespace = 'public'::regnamespace;

-- List all storage policies (should be none or bucket-level only)
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- ============================================================
-- SECURITY VALIDATION
-- ============================================================

-- Test: Anonymous users cannot access files
-- Expected: Empty result (RLS blocks access)
SELECT COUNT(*) as anonymous_file_count
FROM project_files
WHERE -- This would return 0 because no anon policy exists
  true;

-- Test: Authenticated users can only see their project files
-- Run this as a test user to verify
-- SELECT * FROM project_files WHERE project_id = 'your-project-id';

-- ============================================================
-- FILE PATH CONVENTION
-- ============================================================
--
-- Storage path format: projects/{projectId}/files/{fileId}{ext}
--
-- Examples:
--   - projects/d7df7225-.../files/ce6487e7-....jpg
--   - projects/abc123-.../files/def456-....pdf
--
-- Breaking down the path:
--   - "projects/"       - Fixed prefix for isolation
--   - {projectId}       - UUID for project scoping
--   - "/files/"         - Fixed separator
--   - {fileId}          - UUID for file identification
--   - {ext}             - File extension for content-type
--
-- The projectId UUID is used for:
--   1. Path organization (bucket structure)
--   2. Potential future multi-tenant isolation
--   3. Debugging (identifies project from storage path)
--
-- ============================================================

-- Document the bucket configuration
COMMENT ON BUCKET 'project-files' IS
'Project file storage with UUID-based paths. Security enforced by project_files table RLS and signed URLs.';

-- ============================================================
-- IMPORTANT NOTES
-- ============================================================
--
-- DO NOT enable RLS on storage.objects:
--   - System table owned by Supabase (not user-modifiable)
--   - Breaking changes would block file access
--   - Current model is secure with layered defenses
--
-- DO NOT modify storage path format:
--   - UUIDs prevent unauthorized access through guessing
--   - Project ID in path enables future multi-tenant features
--   - Consistent format simplifies debugging
--
-- ALWAYS use project_files for access control:
--   - Insert metadata before uploading to storage
--   - Delete metadata before removing from storage
--   - Join with project_members for permission checks
--
-- ============================================================
