-- ============================================================
-- URI Finance - Initial Database Schema
-- Consolidated migration for new Supabase project
-- ============================================================

-- Transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- ============================================================
-- Core Tables
-- ============================================================

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  invite_code TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  currency TEXT NOT NULL DEFAULT 'USD',
  column_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project members table
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- Project bans table
CREATE TABLE public.project_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Project categories table
CREATE TABLE public.project_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  parent_id UUID REFERENCES public.project_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Add index for parent_id to enable efficient tree queries
CREATE INDEX project_categories_parent_id_idx ON public.project_categories(parent_id);

-- Add comment to explain the hierarchy
COMMENT ON COLUMN public.project_categories.parent_id IS 'Parent category ID for sub-categories. NULL means top-level category.';

-- Custom columns table
CREATE TABLE public.custom_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  column_type TEXT NOT NULL DEFAULT 'numeric',
  masked BOOLEAN NOT NULL DEFAULT false,
  suggestions TEXT[] NOT NULL DEFAULT '{}'::text[],
  required BOOLEAN NOT NULL DEFAULT false,
  suggestion_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  custom_values JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project invites table (individual invite codes)
CREATE TABLE public.project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  label TEXT,
  email TEXT DEFAULT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(code)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_transactions_deleted_at ON public.transactions (deleted_at);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper Functions
-- ============================================================

-- Check if user is member of project
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  )
$$;

-- Seed default categories when a project is created
CREATE OR REPLACE FUNCTION public.seed_project_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.project_categories (project_id, name) VALUES
    (NEW.id, 'Salary'),
    (NEW.id, 'Freelance'),
    (NEW.id, 'Sales'),
    (NEW.id, 'Investment'),
    (NEW.id, 'Food'),
    (NEW.id, 'Transport'),
    (NEW.id, 'Utilities'),
    (NEW.id, 'Entertainment'),
    (NEW.id, 'Shopping'),
    (NEW.id, 'Health'),
    (NEW.id, 'Education'),
    (NEW.id, 'General');
  RETURN NEW;
END;
$$;

-- Rename custom column key
CREATE OR REPLACE FUNCTION public.rename_custom_column_key(
  _project_id UUID,
  _old_name TEXT,
  _new_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.transactions
  SET custom_values = (custom_values - _old_name) || jsonb_build_object(_new_name, custom_values -> _old_name)
  WHERE project_id = _project_id
    AND deleted_at IS NULL
    AND custom_values ? _old_name;
END;
$$;

-- Remove custom column key
CREATE OR REPLACE FUNCTION public.remove_custom_column_key(_project_id UUID, _column_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.transactions
  SET custom_values = custom_values - _column_name
  WHERE project_id = _project_id
    AND deleted_at IS NULL
    AND custom_values ? _column_name;
END;
$$;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Get database stats
CREATE OR REPLACE FUNCTION public.get_db_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'db_size', pg_database_size(current_database()),
    'db_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'tables', (
      SELECT json_agg(json_build_object(
        'table_name', t.table_name,
        'row_count', (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name),
        'size', pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)))
      ))
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- ============================================================
-- Global Admin Functions
-- ============================================================

-- Get all users with their project names
CREATE OR REPLACE FUNCTION public.get_all_users()
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

-- Delete a project (cascade delete all related data)
CREATE OR REPLACE FUNCTION public.admin_delete_project(_project_id UUID)
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

-- ============================================================
-- Triggers
-- ============================================================

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_project_created_seed_categories
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_project_categories();

-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- ==================== Projects ====================

CREATE POLICY "Members can view their projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can find project by invite code"
  ON public.projects FOR SELECT TO authenticated
  USING (true);

-- ==================== Project Members ====================

CREATE POLICY "Members can view project members"
  ON public.project_members FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Users can join projects"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can remove members"
  ON public.project_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update member roles"
  ON public.project_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- ==================== Project Bans ====================

CREATE POLICY "Members can view bans"
  ON public.project_bans FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Owners can ban"
  ON public.project_bans FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_bans.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Owners can unban"
  ON public.project_bans FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_bans.project_id AND projects.owner_id = auth.uid()));

-- ==================== Project Categories ====================

CREATE POLICY "Members can view project categories"
  ON public.project_categories FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can add categories"
  ON public.project_categories FOR INSERT TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can delete categories"
  ON public.project_categories FOR DELETE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can update categories"
  ON public.project_categories FOR UPDATE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- ==================== Custom Columns ====================

CREATE POLICY "Members can view custom columns"
  ON public.custom_columns FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can insert custom columns"
  ON public.custom_columns FOR INSERT TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can delete custom columns"
  ON public.custom_columns FOR DELETE TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can update custom columns"
  ON public.custom_columns FOR UPDATE TO authenticated
  USING (is_project_member(auth.uid(), project_id))
  WITH CHECK (is_project_member(auth.uid(), project_id));

-- ==================== Transactions ====================

CREATE POLICY "Members can view project transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can add transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_project_member(auth.uid(), project_id)
  );

CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can update project transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = transactions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- ==================== Project Invites ====================

CREATE POLICY "Members can view invites"
  ON public.project_invites FOR SELECT TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can create invites"
  ON public.project_invites FOR INSERT TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id) AND auth.uid() = created_by);

CREATE POLICY "Owners can delete invites"
  ON public.project_invites FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_invites.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Anyone can claim unused invite"
  ON public.project_invites FOR UPDATE TO authenticated
  USING (used_by IS NULL)
  WITH CHECK (auth.uid() = used_by);

CREATE POLICY "Anyone can find invite by code"
  ON public.project_invites FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- File Storage (SPEC-STORAGE-001)
-- ============================================================

-- Project files table for file metadata
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- CHECK constraint: Ensure storage_path is bound to project_id
  CONSTRAINT storage_path_bounded_to_project CHECK (storage_path LIKE 'projects/' || project_id || '/%')
);

-- Create indexes for efficient queries
CREATE INDEX project_files_project_id_idx ON public.project_files(project_id);
CREATE INDEX project_files_created_at_idx ON public.project_files(created_at DESC);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Storage Security Model (SPEC-STORAGE-001)
-- ============================================================
--
-- HYBRID SECURITY APPROACH:
--
-- 1. storage.objects (Supabase Storage): RLS DISABLED
--    - System table owned by Supabase (cannot enable RLS)
--    - Access controlled by signed URLs (time-limited tokens)
--    - Files stored with random UUIDs (unguessable paths)
--
-- 2. project_files table: RLS ENABLED
--    - Controls all metadata access
--    - Enforces project membership checks
--    - Provides audit trail of uploads/deletes
--
-- SECURITY LAYERS:
--   Layer 1: Authentication required for all operations
--   Layer 2: project_files RLS checks project membership
--   Layer 3: Signed URLs expire after 60 minutes
--   Layer 4: Random UUIDs prevent path guessing
--
-- FILE PATH CONVENTION:
--   Format: projects/{projectId}/files/{fileId}{ext}
--   Example: projects/d7df7225-.../files/ce6487e7-....jpg
--
--   Breaking down the path:
--     - "projects/"       - Fixed prefix for isolation
--     - {projectId}       - UUID for project scoping
--     - "/files/"         - Fixed separator
--     - {fileId}          - UUID for file identification
--     - {ext}             - File extension for content-type
--
-- IMPORTANT: Do not attempt to enable RLS on storage.objects
--   - It's a system table owned by Supabase
--   - Current model is secure with layered defenses
--   - Breaking changes would block all file access
--
-- ============================================================

-- RLS Policies: Project members can view files
CREATE POLICY "Project members can view files"
ON public.project_files FOR SELECT
USING (public.is_project_member(auth.uid(), project_id));

-- RLS Policies: Project members can upload files
-- Validates: 1) User is project member, 2) uploaded_by matches user, 3) storage_path is prefixed with project_id
CREATE POLICY "Project members can upload files"
ON public.project_files FOR INSERT
WITH CHECK (
  public.is_project_member(auth.uid(), project_id) AND
  uploaded_by = auth.uid() AND
  -- Ensure storage_path starts with "projects/{project_id}/" (using LIKE, not regex)
  storage_path LIKE ('projects/' || project_id::text || '/%')
);

-- RLS Policies: Only project owner/admin can delete files
CREATE POLICY "Project owner/admin can delete files"
ON public.project_files FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = project_files.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'admin')
  )
);

-- Add project_files table to Realtime publication for collaborative updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_files;

-- ============================================================
-- Storage Functions (SPEC-STORAGE-001)
-- ============================================================

-- Get storage stats for the current project
-- Returns file count, total size, breakdown by file type, and recent files
-- Uses TEXT parameter to work with Supabase RPC (which passes UUIDs as TEXT)
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

  -- Get recent files (without user email to avoid auth.users access issues)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_storage_stats(TEXT) TO authenticated;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.project_files IS 'Stores metadata for files uploaded to project storage buckets';
COMMENT ON COLUMN public.project_files.storage_path IS 'Path in Supabase Storage bucket (format: projects/{projectId}/files/{fileId}{ext})';
COMMENT ON COLUMN public.project_files.file_size IS 'File size in bytes';
COMMENT ON CONSTRAINT storage_path_bounded_to_project ON public.project_files IS 'Ensures storage_path is scoped to project_id';
COMMENT ON FUNCTION public.get_storage_stats(UUID) IS 'Returns storage statistics for a project including file counts, sizes, and recent uploads';
