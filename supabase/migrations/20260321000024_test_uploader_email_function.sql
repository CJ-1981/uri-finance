-- Test query to get a real project ID and test the function
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

-- Step 1: Get a real project ID
SELECT id, name FROM public.projects LIMIT 1;

-- Step 2: Test the function with the real project ID (replace ACTUAL_PROJECT_ID below)
-- SELECT * FROM public.get_project_files_with_email('ACTUAL_PROJECT_ID'::uuid);

-- Step 3: Check if the function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_project_files_with_email';

-- Step 4: Check function permissions
SELECT grantee, grantor, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
AND routine_name = 'get_project_files_with_email';
