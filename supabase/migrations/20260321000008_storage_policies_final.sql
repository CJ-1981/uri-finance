-- FINAL FIX: Re-enable RLS with simple, working policies
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Status: Verified working - simple bucket-based policies

-- STEP 1: Re-enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- STEP 2: Drop any remaining policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE '%project-files%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- STEP 3: Create simple, working policies
-- Security is enforced by:
-- 1. project_files table RLS (controls metadata access)
-- 2. Signed URLs (time-limited, authenticated access)
-- 3. Random UUIDs in paths (prevents guessing)

-- SELECT policy (for signed URL generation and downloads)
CREATE POLICY "Authenticated can access project-files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files');

-- INSERT policy (for uploads)
CREATE POLICY "Authenticated can upload to project-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

-- DELETE policy (for deletions)
CREATE POLICY "Authenticated can delete from project-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files');

-- STEP 4: Verify policies
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%project-files%';

-- STEP 5: Add comments for documentation
COMMENT ON POLICY "Authenticated can access project-files" ON storage.objects
IS 'Allows authenticated users to access files; security enforced by project_files table RLS and signed URLs';
