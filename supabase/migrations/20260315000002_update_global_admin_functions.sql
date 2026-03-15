-- Update Global Admin Functions
-- This migration updates the get_all_users function to include project names
-- and adds a function to delete projects

-- Drop existing function (since we're changing return type)
DROP FUNCTION IF EXISTS public.get_all_users();

-- Get all users with their project names
CREATE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  project_count BIGINT,
  projects JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT u.id, u.email, u.created_at, COUNT(DISTINCT pm.project_id) as project_count,
         COALESCE(
           jsonb_agg(
             jsonb_build_object('id', p.id, 'name', p.name)
             ORDER BY p.name
           ) FILTER (WHERE p.id IS NOT NULL),
           '[]'::jsonb
         ) as projects
  FROM auth.users u
  LEFT JOIN public.project_members pm ON u.id = pm.user_id
  LEFT JOIN public.projects p ON pm.project_id = p.id
  GROUP BY u.id, u.email, u.created_at
  ORDER BY u.created_at DESC;
$$;

-- Delete a project (cascade delete all related data)
CREATE FUNCTION public.admin_delete_project(_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Delete project members
  DELETE FROM public.project_members WHERE project_id = _project_id;

  -- Delete project bans
  DELETE FROM public.project_bans WHERE project_id = _project_id;

  -- Delete project invites
  DELETE FROM public.project_invites WHERE project_id = _project_id;

  -- Delete custom columns
  DELETE FROM public.custom_columns WHERE project_id = _project_id;

  -- Delete transactions (including soft-deleted ones)
  DELETE FROM public.transactions WHERE project_id = _project_id;

  -- Delete project categories
  DELETE FROM public.project_categories WHERE project_id = _project_id;

  -- Delete the project itself
  DELETE FROM public.projects WHERE id = _project_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
    RETURN FALSE;
END;
$$;
