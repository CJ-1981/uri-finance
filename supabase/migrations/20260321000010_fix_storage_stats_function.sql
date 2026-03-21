-- Migration: Fix storage stats function to handle edge cases
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21
-- Purpose: Remove auth.users access causing 400 errors

-- Drop and recreate function without auth.users access
CREATE OR REPLACE FUNCTION public.get_storage_stats(p_project_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  file_count BIGINT;
BEGIN
  -- Get total count first
  SELECT COUNT(*) INTO file_count
  FROM project_files
  WHERE project_id = p_project_id;

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
        SELECT COALESCE(json_agg(json_build_object(
          'id', id,
          'file_name', file_name,
          'file_size', file_size,
          'file_type', file_type,
          'uploaded_at', created_at,
          'uploaded_by', uploaded_by
        )), '[]'::json)
        FROM project_files
        WHERE project_id = p_project_id
        ORDER BY created_at DESC
        LIMIT 5
      )
    ) INTO result
    FROM project_files
    WHERE project_id = p_project_id;
  END IF;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_storage_stats(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_storage_stats(UUID) IS 'Returns storage statistics for a project including file counts, sizes, and recent uploads. Updated to handle empty results gracefully.';
