-- Comprehensive diagnostic for get_storage_stats function
-- Run each section separately in Supabase Dashboard SQL Editor

-- ============================================================
-- SECTION 1: Check if function exists and its signature
-- ============================================================
SELECT
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_storage_stats';

-- ============================================================
-- SECTION 2: Check what parameters the function expects
-- ============================================================
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as parameters,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_storage_stats';

-- ============================================================
-- SECTION 3: Test the function with a known project_id
-- ============================================================
-- First, get a project_id that has files:
SELECT project_id, COUNT(*) as file_count
FROM project_files
GROUP BY project_id;

-- Then test with that project_id (replace UUID below with actual project_id from above):
-- Test with TEXT parameter:
SELECT public.get_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6');

-- If TEXT doesn't work, test with UUID:
SELECT public.get_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6'::UUID);

-- ============================================================
-- SECTION 4: Check RLS policies on project_files
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  substr(qual, 1, 100) as qual_preview
FROM pg_policies
WHERE tablename = 'project_files';

-- ============================================================
-- SECTION 5: Check if user has permission to execute function
-- ============================================================
SELECT
  grantee,
  privilege_type,
  grantor
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name = 'get_storage_stats';
