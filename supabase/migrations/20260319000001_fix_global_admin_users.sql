-- Fix get_all_users() to only return users with active project memberships
-- This prevents showing removed members who have 0 projects

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_all_users();

-- Recreate function with INNER JOIN to filter out users with no active memberships
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
  INNER JOIN public.project_members pm ON u.id = pm.user_id
  INNER JOIN public.projects p ON pm.project_id = p.id
  GROUP BY u.id, u.email, u.created_at
  HAVING COUNT(DISTINCT pm.project_id) > 0
  ORDER BY u.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
