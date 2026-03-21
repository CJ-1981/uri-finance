-- Debug: Check storage configuration
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if the bucket exists
SELECT * FROM storage.buckets WHERE id = 'project-files';

-- 2. Check what files exist in storage
SELECT name, bucket_id, created_at FROM storage.objects WHERE bucket_id = 'project-files' LIMIT 5;

-- 3. Check existing storage policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  substr(qual, 1, 100) as qual_preview
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage';

-- 4. Test if RLS is enabled on storage.objects
SELECT relname, relforcerowsecurity
FROM pg_class
WHERE relname = 'objects'
  AND relnamespace = 'storage'::regnamespace;
