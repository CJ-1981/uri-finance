-- Migration: Fix get_storage_stats function SQL error
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Error: column "project_files.created_at" must appear in the GROUP BY clause or be used in an aggregate function

-- Drop and recreate with fixed SQL structure
DROP FUNCTION IF EXISTS public.get_storage_stats(TEXT);

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
    -- Build result with all stats (removed outer FROM project_files which was causing GROUP BY error)
    SELECT json_build_object(
      'total_files', file_count,
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
    FROM (SELECT 1) dummy;  -- Removed FROM project_files, use dummy instead
  END IF;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_storage_stats(TEXT) IS 'Returns storage statistics for a project. Fixed GROUP BY error.';
