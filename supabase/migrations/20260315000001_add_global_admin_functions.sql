-- Global Admin Functions
-- These functions provide system-wide visibility into all users and projects for admin management

-- Get all users with their project counts
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  project_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT u.id, u.email, u.created_at, COUNT(DISTINCT pm.project_id) as project_count
  FROM auth.users u
  LEFT JOIN public.project_members pm ON u.id = pm.user_id
  GROUP BY u.id, u.email, u.created_at
  ORDER BY u.created_at DESC;
$$;

-- Get all projects with owner/member info
CREATE OR REPLACE FUNCTION public.get_all_projects()
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_email TEXT,
  member_count BIGINT,
  transaction_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.id, p.name, u.email as owner_email,
         COUNT(DISTINCT pm.user_id) as member_count,
         COUNT(DISTINCT t.id) as transaction_count,
         p.created_at
  FROM public.projects p
  JOIN auth.users u ON p.owner_id = u.id
  LEFT JOIN public.project_members pm ON p.id = pm.project_id
  LEFT JOIN public.transactions t ON p.id = t.project_id AND t.deleted_at IS NULL
  GROUP BY p.id, p.name, u.email, p.created_at
  ORDER BY p.created_at DESC;
$$;

-- Remove user from all projects (not delete from auth.users)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.project_members WHERE user_id = _user_id;
  DELETE FROM public.project_bans WHERE user_id = _user_id;
  UPDATE public.project_invites
  SET used_by = NULL, used_at = NULL
  WHERE used_by = _user_id;
  RETURN TRUE;
END;
$$;
