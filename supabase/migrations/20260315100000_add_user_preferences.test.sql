-- ============================================================
-- Test Suite: user_preferences Table
-- Purpose: Verify database schema, RLS policies, and triggers
-- SPEC: SPEC-PERSIST-001
-- ============================================================

-- Test 1: Verify table exists with correct structure
DO $$
BEGIN
  -- Check table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
  ) THEN
    RAISE EXCEPTION 'user_preferences table does not exist';
  END IF;

  -- Check columns exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'user_preferences.id column does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'user_preferences.user_id column does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'default_project_id'
  ) THEN
    RAISE EXCEPTION 'user_preferences.default_project_id column does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'created_at'
  ) THEN
    RAISE EXCEPTION 'user_preferences.created_at column does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'user_preferences.updated_at column does not exist';
  END IF;

  RAISE NOTICE '✓ Test 1 PASSED: Table structure is correct';
END $$;

-- Test 2: Verify unique constraint on user_id
DO $$
BEGIN
  -- Check unique constraint exists
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conname = 'user_preferences_user_id_key'
  ) THEN
    RAISE EXCEPTION 'Unique constraint on user_id does not exist';
  END IF;

  RAISE NOTICE '✓ Test 2 PASSED: Unique constraint on user_id exists';
END $$;

-- Test 3: Verify foreign key constraints
DO $$
BEGIN
  -- Check user_id foreign key to auth.users
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conname = 'user_preferences_user_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Foreign key on user_id to auth.users does not exist';
  END IF;

  -- Check default_project_id foreign key to projects
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conname = 'user_preferences_default_project_id_fkey'
  ) THEN
    RAISE EXCEPTION 'Foreign key on default_project_id to projects does not exist';
  END IF;

  RAISE NOTICE '✓ Test 3 PASSED: Foreign key constraints exist';
END $$;

-- Test 4: Verify ON DELETE behavior
DO $$
BEGIN
  -- Check user_id has ON DELETE CASCADE
  DECLARE
    fk_del_action TEXT;
  BEGIN
    SELECT confdeltype::text
    INTO fk_del_action
    FROM pg_constraint
    WHERE conname = 'user_preferences_user_id_fkey';

    IF fk_del_action != 'c' THEN
      RAISE EXCEPTION 'user_id should have ON DELETE CASCADE';
    END IF;
  END;

  -- Check default_project_id has ON DELETE SET NULL
  BEGIN
    SELECT confdeltype::text
    INTO fk_del_action
    FROM pg_constraint
    WHERE conname = 'user_preferences_default_project_id_fkey';

    IF fk_del_action != 'n' THEN
      RAISE EXCEPTION 'default_project_id should have ON DELETE SET NULL';
    END IF;
  END;

  RAISE NOTICE '✓ Test 4 PASSED: ON DELETE behavior is correct';
END $$;

-- Test 5: Verify RLS is enabled
DO $$
BEGIN
  DECLARE
    rls_enabled BOOLEAN;
  BEGIN
    SELECT relforcerowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'user_preferences'
    AND relnamespace = 'public'::regnamespace;

    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'RLS is not enabled on user_preferences';
    END IF;
  END;

  RAISE NOTICE '✓ Test 5 PASSED: RLS is enabled';
END $$;

-- Test 6: Verify RLS policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_preferences'
    AND policyname = 'Users can manage own preferences'
  ) THEN
    RAISE EXCEPTION 'RLS policy "Users can manage own preferences" does not exist';
  END IF;

  RAISE NOTICE '✓ Test 6 PASSED: RLS policy exists';
END $$;

-- Test 7: Verify index exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'user_preferences'
    AND indexname = 'idx_user_preferences_user'
  ) THEN
    RAISE EXCEPTION 'Index idx_user_preferences_user does not exist';
  END IF;

  RAISE NOTICE '✓ Test 7 PASSED: Performance index exists';
END $$;

-- Test 8: Verify updated_at trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_trigger
    WHERE tgname = 'update_user_preferences_updated_at'
  ) THEN
    RAISE EXCEPTION 'Trigger update_user_preferences_updated_at does not exist';
  END IF;

  RAISE NOTICE '✓ Test 8 PASSED: updated_at trigger exists';
END $$;

-- Test 9: Verify membership removal trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_trigger
    WHERE tgname = 'clear_preference_on_member_removal'
  ) THEN
    RAISE EXCEPTION 'Trigger clear_preference_on_member_removal does not exist';
  END IF;

  RAISE NOTICE '✓ Test 9 PASSED: Membership removal trigger exists';
END $$;

-- Test 10: Verify update_updated_at_column function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    RAISE EXCEPTION 'Function update_updated_at_column does not exist';
  END IF;

  RAISE NOTICE '✓ Test 10 PASSED: update_updated_at_column function exists';
END $$;

-- Test 11: Verify clear_project_preference_on_removal function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'clear_project_preference_on_removal'
  ) THEN
    RAISE EXCEPTION 'Function clear_project_preference_on_removal does not exist';
  END IF;

  RAISE NOTICE '✓ Test 11 PASSED: clear_project_preference_on_removal function exists';
END $$;

-- ============================================================
-- Integration Tests
-- ============================================================

-- Test 12: Test ON DELETE CASCADE on user_id
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_project_id UUID := gen_random_uuid();
  pref_id UUID;
BEGIN
  -- Insert test data
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'test@example.com');

  INSERT INTO projects (id, name, owner_id, invite_code, currency)
  VALUES (test_project_id, 'Test Project', test_user_id, 'test-invite', 'USD');

  INSERT INTO user_preferences (user_id, default_project_id)
  VALUES (test_user_id, test_project_id)
  RETURNING id INTO pref_id;

  -- Delete user
  DELETE FROM auth.users WHERE id = test_user_id;

  -- Verify preference is cascaded
  IF EXISTS (
    SELECT FROM user_preferences WHERE id = pref_id
  ) THEN
    RAISE EXCEPTION 'ON DELETE CASCADE failed: preference should be deleted';
  END IF;

  -- Cleanup
  DELETE FROM projects WHERE id = test_project_id;

  RAISE NOTICE '✓ Test 12 PASSED: ON DELETE CASCADE works correctly';
EXCEPTION WHEN OTHERS THEN
  -- Cleanup on error
  DELETE FROM projects WHERE id = test_project_id;
  RAISE;
END $$;

-- Test 13: Test ON DELETE SET NULL on default_project_id
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_project_id UUID := gen_random_uuid();
  pref_id UUID;
  pref_record RECORD;
BEGIN
  -- Insert test data
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'test@example.com');

  INSERT INTO projects (id, name, owner_id, invite_code, currency)
  VALUES (test_project_id, 'Test Project', test_user_id, 'test-invite', 'USD');

  INSERT INTO user_preferences (user_id, default_project_id)
  VALUES (test_user_id, test_project_id)
  RETURNING id INTO pref_id;

  -- Delete project
  DELETE FROM projects WHERE id = test_project_id;

  -- Verify preference is set to NULL
  SELECT * INTO pref_record FROM user_preferences WHERE id = pref_id;

  IF pref_record.default_project_id IS NOT NULL THEN
    RAISE EXCEPTION 'ON DELETE SET NULL failed: default_project_id should be NULL';
  END IF;

  -- Cleanup
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM user_preferences WHERE id = pref_id;

  RAISE NOTICE '✓ Test 13 PASSED: ON DELETE SET NULL works correctly';
EXCEPTION WHEN OTHERS THEN
  -- Cleanup on error
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM user_preferences WHERE id = test_project_id;
  RAISE;
END $$;

-- Test 14: Test membership removal trigger
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_project_id UUID := gen_random_uuid();
  membership_id UUID;
  pref_id UUID;
  pref_record RECORD;
BEGIN
  -- Insert test data
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'test@example.com');

  INSERT INTO projects (id, name, owner_id, invite_code, currency)
  VALUES (test_project_id, 'Test Project', test_user_id, 'test-invite', 'USD');

  INSERT INTO user_preferences (user_id, default_project_id)
  VALUES (test_user_id, test_project_id)
  RETURNING id INTO pref_id;

  -- Add user as member
  INSERT INTO project_members (user_id, project_id, role)
  VALUES (test_user_id, test_project_id, 'member')
  RETURNING id INTO membership_id;

  -- Remove membership (trigger should clear preference)
  DELETE FROM project_members WHERE id = membership_id;

  -- Verify preference is cleared
  SELECT * INTO pref_record FROM user_preferences WHERE id = pref_id;

  IF pref_record.default_project_id IS NOT NULL THEN
    RAISE EXCEPTION 'Trigger failed: default_project_id should be NULL after membership removal';
  END IF;

  -- Cleanup
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM projects WHERE id = test_project_id;
  DELETE FROM user_preferences WHERE id = pref_id;

  RAISE NOTICE '✓ Test 14 PASSED: Membership removal trigger works correctly';
EXCEPTION WHEN OTHERS THEN
  -- Cleanup on error
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM projects WHERE id = test_project_id;
  DELETE FROM project_members WHERE user_id = test_user_id;
  DELETE FROM user_preferences WHERE user_id = test_user_id;
  RAISE;
END $$;

-- Test 15: Test updated_at trigger
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_project_id UUID := gen_random_uuid();
  pref_id UUID;
  created_time TIMESTAMPTZ;
  updated_time TIMESTAMPTZ;
BEGIN
  -- Insert test data
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'test@example.com');

  INSERT INTO projects (id, name, owner_id, invite_code, currency)
  VALUES (test_project_id, 'Test Project', test_user_id, 'test-invite', 'USD');

  -- Create preference
  INSERT INTO user_preferences (user_id, default_project_id)
  VALUES (test_user_id, test_project_id)
  RETURNING id, created_at INTO pref_id, created_time;

  -- Wait to ensure different timestamp
  PERFORM pg_sleep(0.01);

  -- Update preference
  UPDATE user_preferences
  SET default_project_id = test_project_id
  WHERE id = pref_id;

  -- Check updated_at changed
  SELECT updated_at INTO updated_time FROM user_preferences WHERE id = pref_id;

  IF updated_time <= created_time THEN
    RAISE EXCEPTION 'Trigger failed: updated_at should be greater than created_at after update';
  END IF;

  -- Cleanup
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM projects WHERE id = test_project_id;
  DELETE FROM user_preferences WHERE id = pref_id;

  RAISE NOTICE '✓ Test 15 PASSED: updated_at trigger works correctly';
EXCEPTION WHEN OTHERS THEN
  -- Cleanup on error
  DELETE FROM auth.users WHERE id = test_user_id;
  DELETE FROM projects WHERE id = test_project_id;
  DELETE FROM user_preferences WHERE id = test_user_id;
  RAISE;
END $$;

-- ============================================================
-- Summary
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All user_preferences tests PASSED ✓';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
