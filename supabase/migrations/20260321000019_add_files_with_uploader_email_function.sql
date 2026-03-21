-- Migration: Add function to get files with uploader email
-- SPEC: SPEC-STORAGE-001
-- Created: 2026-03-21

-- Create function to get project files with uploader email
-- SECURITY DEFINER allows access to auth.users email while maintaining RLS
CREATE OR REPLACE FUNCTION public.get_project_files_with_email(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  uploaded_by UUID,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  uploader_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pf.id,
    pf.project_id,
    pf.uploaded_by,
    pf.file_name,
    pf.file_type,
    pf.file_size,
    pf.storage_path,
    pf.remark,
    pf.created_at,
    au.email
  FROM public.project_files pf
  LEFT JOIN auth.users au ON pf.uploaded_by = au.id
  WHERE pf.project_id = p_project_id
  ORDER BY pf.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_project_files_with_email(UUID) TO authenticated;

-- Create view for easy access (optional, for direct querying)
CREATE OR REPLACE VIEW public.project_files_with_email AS
SELECT
  pf.id,
  pf.project_id,
  pf.uploaded_by,
  pf.file_name,
  pf.file_type,
  pf.file_size,
  pf.storage_path,
  pf.remark,
  pf.created_at,
  au.email AS uploader_email
FROM public.project_files pf
LEFT JOIN auth.users au ON pf.uploaded_by = au.id;

-- Grant select on view to authenticated users
GRANT SELECT ON public.project_files_with_email TO authenticated;
