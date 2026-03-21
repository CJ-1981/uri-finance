-- Migration: Fix get_storage_stats function - remove invalid aggregate
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

DROP FUNCTION IF EXISTS public.get_storage_stats(TEXT);

CREATE OR REPLACE FUNCTION public.get_storage_stats(p_project_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  project_uuid UUID;
  total_size BIGINT;
BEGIN
  -- Convert text to UUID
  project_uuid := p_project_id::UUID;

  -- Get total size separately
  SELECT COALESCE(SUM(file_size), 0) INTO total_size
  FROM project_files
  WHERE project_id = project_uuid;

  -- Build result
  SELECT json_build_object(
    'total_files', COUNT(*),
    'total_size', total_size,
    'total_size_pretty', pg_size_pretty(total_size),
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
  FROM (SELECT 1) dummy;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_storage_stats(TEXT) IS 'Returns storage statistics for a project. Fixed aggregate context issue.';
