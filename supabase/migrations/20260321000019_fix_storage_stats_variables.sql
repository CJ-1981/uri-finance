-- Migration: Completely rewrite get_storage_stats to avoid subquery issues
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

-- Force drop both versions
DROP FUNCTION IF EXISTS public.get_storage_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_storage_stats(UUID) CASCADE;

-- Create new version - simple approach without nested subqueries in json_build_object
CREATE OR REPLACE FUNCTION public.get_storage_stats(p_project_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_uuid UUID;
  v_total_files BIGINT;
  v_total_size BIGINT;
  v_by_type JSON;
  v_largest_file JSON;
  v_recent_files JSON;
BEGIN
  -- Convert text to UUID
  project_uuid := p_project_id::UUID;

  -- Get total files
  SELECT COUNT(*) INTO v_total_files
  FROM project_files
  WHERE project_id = project_uuid;

  -- Get total size
  SELECT COALESCE(SUM(file_size), 0) INTO v_total_size
  FROM project_files
  WHERE project_id = project_uuid;

  -- Get breakdown by type
  SELECT COALESCE(json_agg(json_build_object(
    'file_type', file_type,
    'count', count,
    'size', size,
    'size_pretty', pg_size_pretty(size::bigint)
  )), '[]'::json) INTO v_by_type
  FROM (
    SELECT file_type, COUNT(*) as count, SUM(file_size) as size
    FROM project_files
    WHERE project_id = project_uuid
    GROUP BY file_type
  ) sub;

  -- Get largest file
  SELECT json_build_object(
    'file_name', file_name,
    'file_size', file_size,
    'file_size_pretty', pg_size_pretty(file_size),
    'file_type', file_type,
    'uploaded_at', created_at
  ) INTO v_largest_file
  FROM project_files
  WHERE project_id = project_uuid
  ORDER BY file_size DESC
  LIMIT 1;

  -- Get recent files
  SELECT COALESCE(json_agg(json_build_object(
    'id', id,
    'file_name', file_name,
    'file_size', file_size,
    'file_type', file_type,
    'uploaded_at', created_at,
    'uploaded_by', uploaded_by
  )), '[]'::json) INTO v_recent_files
  FROM project_files
  WHERE project_id = project_uuid
  ORDER BY created_at DESC
  LIMIT 5;

  -- Build final result
  RETURN json_build_object(
    'total_files', v_total_files,
    'total_size', v_total_size,
    'total_size_pretty', pg_size_pretty(v_total_size),
    'by_type', v_by_type,
    'largest_file', v_largest_file,
    'recent_files', v_recent_files
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_storage_stats(TEXT) IS 'Returns storage statistics. All complex queries separated into variables to avoid GROUP BY issues.';
