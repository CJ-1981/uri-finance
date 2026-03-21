-- Diagnostic: Check actual project_files table structure
-- Run this in Supabase Dashboard SQL Editor

-- Check if project_files table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'project_files'
) as table_exists;

-- Get actual column names in project_files
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'project_files'
ORDER BY ordinal_position;

-- Check if there's any data in project_files
SELECT * FROM project_files LIMIT 1;

-- Alternative: Check all tables starting with 'project'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%file%'
ORDER BY table_name;
