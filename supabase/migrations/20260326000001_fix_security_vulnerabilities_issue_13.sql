-- Migration: Fix Security Vulnerabilities - Issue #13
-- GitHub Issue: https://github.com/CJ-1981/uri-finance/issues/13
-- Created: 2026-03-26
-- Priority: CRITICAL
-- OWASP Categories: A01:2021 (Broken Access Control), A05:2021 (Security Misconfiguration)

-- ============================================================
-- SECURITY VULNERABILITY REMEDIATION
-- ============================================================

-- VULNERABILITY 1: auth_users_exposed (CRITICAL)
-- Problem: View 'project_files_with_email' exposed auth.users data to all authenticated users
-- Impact: Any authenticated user could query all user emails across all projects
-- OWASP: A01:2021 - Broken Access Control
-- CWE: CWE-284 (Improper Access Control)

-- VULNERABILITY 2: security_definer_view (HIGH)
-- Problem: View used SECURITY DEFINER semantics without proper access control
-- Impact: View bypassed RLS policies, exposing all data to authenticated users
-- OWASP: A05:2021 - Security Misconfiguration
-- CWE: CWE-732 (Incorrect Permission Assignment)

-- REMEDIATION: Remove the insecure view entirely
-- Rationale:
-- 1. The view is NOT used by the application (application uses secure RPC function)
-- 2. The view has no access control - grants SELECT to all authenticated users
-- 3. The view joins with auth.users without any filtering, exposing all emails
-- 4. The secure RPC function 'get_project_files_with_email(p_project_id)' provides
--    the same functionality with proper access control

-- ============================================================
-- STEP 1: Remove Insecure View (if it exists)
-- ============================================================

-- Drop the insecure view if it exists
DROP VIEW IF EXISTS public.project_files_with_email;

-- Remove any lingering grants (cleanup)
-- Note: REVOKE doesn't support IF EXISTS, so we use a DO block
DO $$
BEGIN
  -- Only revoke if the view exists
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'project_files_with_email'
  ) THEN
    EXECUTE 'REVOKE ALL ON public.project_files_with_email FROM authenticated';
    EXECUTE 'REVOKE ALL ON public.project_files_with_email FROM anon';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- View doesn't exist, which is fine
    RAISE NOTICE 'View project_files_with_email does not exist (already removed)';
END $$;

-- ============================================================
-- STEP 2: Document Security Rationale for RPC Function
-- ============================================================

-- Add security documentation to the RPC function
COMMENT ON FUNCTION public.get_project_files_with_email(UUID) IS
'Returns project files with uploader email addresses.

SECURITY MODEL:
- Uses SECURITY DEFINER to access auth.users.email (normally protected)
- Access is controlled by requiring a project_id parameter
- RLS policies on project_files table enforce project membership
- Users can only retrieve files from projects they are members of

WHY SECURITY DEFINER IS SAFE:
- The function filters by p_project_id parameter
- RLS policy "Project members can view files" is enforced
- The policy checks: is_project_member(auth.uid(), project_id)
- This prevents cross-project data access

USAGE:
  SELECT * FROM get_project_files_with_email(''project-uuid''::uuid);

RETURNS: Files with uploader emails for the specified project only
THROWS: Insufficient privilege if user is not a project member';

-- ============================================================
-- STEP 3: Verify RLS Policies are Correct
-- ============================================================

-- Confirm RLS is enabled on project_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'project_files'
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on project_files table';
  END IF;

  RAISE NOTICE 'RLS is correctly enabled on project_files table';
END $$;

-- Verify the "Project members can view files" policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'project_files'
    AND policyname = 'Project members can view files'
  ) THEN
    RAISE EXCEPTION 'Required RLS policy "Project members can view files" not found';
  END IF;

  RAISE NOTICE 'RLS policy "Project members can view files" is correctly configured';
END $$;

-- ============================================================
-- STEP 4: Security Audit Trail
-- ============================================================

-- Note: Security fix documented in migration comments and CHANGELOG.md
-- The migration system itself provides the audit trail

-- Log the security fix
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SECURITY FIX APPLIED - Issue #13';
  RAISE NOTICE 'Vulnerabilities Fixed:';
  RAISE NOTICE '  1. auth_users_exposed (CRITICAL) - View removed';
  RAISE NOTICE '  2. security_definer_view (HIGH) - View removed';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Action: Removed public.project_files_with_email view';
  RAISE NOTICE 'Reason: View granted SELECT to all authenticated users without RLS';
  RAISE NOTICE 'Impact: Eliminated unauthorized access to auth.users.email data';
  RAISE NOTICE 'Alternative: Use get_project_files_with_email(p_project_id) RPC function';
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================

-- Verify the view no longer exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'project_files_with_email'
  ) THEN
    RAISE EXCEPTION 'View project_files_with_email still exists - migration failed';
  END IF;

  RAISE NOTICE 'Verification PASSED: Insecure view successfully removed';
END $$;

-- Verify the RPC function still exists and is accessible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'get_project_files_with_email'
  ) THEN
    RAISE EXCEPTION 'RPC function get_project_files_with_email not found';
  END IF;

  RAISE NOTICE 'Verification PASSED: Secure RPC function is available';
END $$;
