-- Migration: Add by_type breakdown to storage stats
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
  project_uuid UUID;
  v_total_files BIGINT;
  v_total_size BIGINT;
  v_by_type JSON;
BEGIN
  project_uuid := p_project_id::UUID;

  SELECT COUNT(*) INTO v_total_files
  FROM project_files
  WHERE project_id = project_uuid;

  SELECT COALESCE(SUM(file_size), 0) INTO v_total_size
  FROM project_files
  WHERE project_id = project_uuid;

  -- Get breakdown by type (into variable first)
  SELECT COALESCE(json_agg(json_build_object(
    'file_type', file_type,
    'count', cnt,
    'size', sz,
    'size_pretty', pg_size_pretty(sz::bigint)
  )), '[]'::json) INTO v_by_type
  FROM (
    SELECT file_type, COUNT(*) as cnt, SUM(file_size) as sz
    FROM project_files
    WHERE project_id = project_uuid
    GROUP BY file_type
  ) type_counts;

  RETURN json_build_object(
    'total_files', v_total_files,
    'total_size', v_total_size,
    'total_size_pretty', pg_size_pretty(v_total_size),
    'by_type', v_by_type,
    'largest_file', NULL::json,
    'recent_files', '[]'::json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;

-- Test it
SELECT public.get_storage_stats('d7df7225-816b-482e-9159-0bcbbec307d6');
