-- Migration: Add storage stats function for file monitoring
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Updated: 2026-03-21 - Fixed auth.users access issue

-- Get storage stats for the current project
-- Returns file count, total size, breakdown by file type, and largest file
CREATE OR REPLACE FUNCTION public.get_storage_stats(p_project_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_files', COUNT(*),
    'total_size', COALESCE(SUM(file_size), 0),
    'total_size_pretty', pg_size_pretty(COALESCE(SUM(file_size), 0)::bigint),
    'by_type', (
      SELECT json_agg(json_build_object(
        'file_type', file_type,
        'count', count,
        'size', size,
        'size_pretty', pg_size_pretty(size::bigint)
      ))
      FROM (
        SELECT file_type, COUNT(*) as count, SUM(file_size) as size
        FROM project_files
        WHERE project_id = p_project_id
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
      WHERE project_id = p_project_id
      ORDER BY file_size DESC
      LIMIT 1
    ),
    'recent_files', (
      SELECT json_agg(json_build_object(
        'id', id,
        'file_name', file_name,
        'file_size', file_size,
        'file_type', file_type,
        'uploaded_at', created_at,
        'uploaded_by', uploaded_by
      ))
      FROM project_files
      WHERE project_id = p_project_id
      ORDER BY created_at DESC
      LIMIT 5
    )
  ) INTO result
  FROM project_files
  WHERE project_id = p_project_id;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_storage_stats(UUID) TO authenticated;
