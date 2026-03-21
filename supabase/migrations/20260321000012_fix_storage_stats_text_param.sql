-- Diagnostic: Check current function definition and fix if needed
-- Run this in Supabase Dashboard SQL Editor

-- Get the actual function definition
SELECT pg_get_functiondef('public.get_storage_stats'::regproc);

-- If that doesn't work, recreate the function with explicit parameter handling:
DROP FUNCTION IF EXISTS public.get_storage_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_storage_stats(p_project_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  file_count BIGINT;
  project_uuid UUID;
BEGIN
  -- Convert text to UUID
  project_uuid := p_project_id::UUID;

  -- Get total count first
  SELECT COUNT(*) INTO file_count
  FROM project_files
  WHERE project_id = project_uuid;

  -- If no files, return empty stats
  IF file_count = 0 THEN
    result := json_build_object(
      'total_files', 0,
      'total_size', 0,
      'total_size_pretty', '0 bytes',
      'by_type', '[]'::json,
      'largest_file', NULL,
      'recent_files', '[]'::json
    );
  ELSE
    SELECT json_build_object(
      'total_files', COUNT(*),
      'total_size', COALESCE(SUM(file_size), 0),
      'total_size_pretty', pg_size_pretty(COALESCE(SUM(file_size), 0)::bigint),
      'by_type', (
        SELECT COALESCE(json_agg(json_build_object(
          'file_type', file_type,
          'count', count,
          'size', size,
          'size_pretty', pg_size_pretty(size::bigint)
        )), '[]'::json)
        FROM (
          SELECT file_type, COUNT(*) as count, SUM(file_size) as size
          FROM project_files
          WHERE project_id = project_uuid
          GROUP BY file_type
        ) sub
      ),
      'largest_file', (
        SELECT json_build_object(
          'file_name', file_name,
          'file_size', file_size,
          'file_size_pretty', pg_size_pretty(file_size),
          'file_type', file_type,
          'uploaded_at', created_at
        )
        FROM project_files
        WHERE project_id = project_uuid
        ORDER BY file_size DESC
        LIMIT 1
      ),
      'recent_files', (
        SELECT COALESCE(json_agg(json_build_object(
          'id', id,
          'file_name', file_name,
          'file_size', file_size,
          'file_type', file_type,
          'uploaded_at', created_at,
          'uploaded_by', uploaded_by
        )), '[]'::json)
        FROM project_files
        WHERE project_id = project_uuid
        ORDER BY created_at DESC
        LIMIT 5
      )
    ) INTO result
    FROM project_files
    WHERE project_id = project_uuid;
  END IF;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;
