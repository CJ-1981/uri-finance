-- Direct test of get_storage_stats function
-- Run this in Supabase Dashboard SQL Editor

-- Test 1: Call the function directly
SELECT public.get_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6');

-- Test 2: If Test 1 works, try with explicit UUID
SELECT public.get_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6'::TEXT);

-- Test 3: Check if there are multiple function versions
SELECT
  proname,
  proargtypes,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'get_storage_stats'
  AND pronamespace = 'public'::regnamespace;

-- Test 4: Force reload by recreating with a different name temporarily
CREATE OR REPLACE FUNCTION public.get_storage_stats_v2(p_project_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  project_uuid UUID;
  file_count BIGINT;
  total_size BIGINT;
BEGIN
  project_uuid := p_project_id::UUID;

  SELECT COUNT(*) INTO file_count
  FROM project_files
  WHERE project_id = project_uuid;

  SELECT COALESCE(SUM(file_size), 0) INTO total_size
  FROM project_files
  WHERE project_id = project_uuid;

  result := json_build_object(
    'total_files', file_count,
    'total_size', total_size,
    'total_size_pretty', pg_size_pretty(total_size)
  );

  RETURN result;
END;
$$;

-- Test the v2 function
SELECT public.get_storage_stats_v2('d7df7225-816b-482e-9159-0bcbbec307d6');
