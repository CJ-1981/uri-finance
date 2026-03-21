-- Diagnostic: Check if get_storage_stats function exists and works
-- Run this in Supabase Dashboard SQL Editor

-- 1. Check if function exists
SELECT
  routine_name,
  routine_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_storage_stats';

-- 2. Check if project_files table has data
SELECT COUNT(*) as file_count
FROM project_files;

-- 3. Try to call the function directly (replace with actual project_id)
-- Uncomment and replace UUID below to test:
-- SELECT public.get_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6'::uuid);

-- 4. Check function permissions
SELECT
  grantee,
  privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name = 'get_storage_stats';
