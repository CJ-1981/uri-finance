-- Migration: Create storage stats with NEW function name to bypass caching
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

-- Create with a completely new name to avoid any caching issues
CREATE OR REPLACE FUNCTION public.get_project_storage_stats(p_project_id TEXT)
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
    'file_type', t.file_type,
    'count', t.count,
    'size', t.size,
    'size_pretty', pg_size_pretty(t.size::bigint)
  )), '[]'::json) INTO v_by_type
  FROM (
    SELECT file_type, COUNT(*) as count, SUM(file_size) as size
    FROM project_files
    WHERE project_id = project_uuid
    GROUP BY file_type
  ) t;

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

GRANT EXECUTE ON FUNCTION public.get_project_storage_stats(TEXT) TO authenticated;

-- Test it
SELECT public.get_project_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6');
