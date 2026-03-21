-- Migration: Fix get_storage_stats function - calculate all aggregates separately
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
  file_count BIGINT;
  total_size BIGINT;
BEGIN
  -- Convert text to UUID
  project_uuid := p_project_id::UUID;

  -- Get file count
  SELECT COUNT(*) INTO file_count
  FROM project_files
  WHERE project_id = project_uuid;

  -- Get total size
  SELECT COALESCE(SUM(file_size), 0) INTO total_size
  FROM project_files
  WHERE project_id = project_uuid;

  -- Build result (all aggregates calculated separately)
  result := json_build_object(
    'total_files', file_count,
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
  );

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_storage_stats(TEXT) IS 'Returns storage statistics for a project. All aggregates calculated separately to avoid GROUP BY issues.';
