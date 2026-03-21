-- Configure CORS for Storage bucket
-- SPEC: SPEC-STORAGE-001
-- Note: CORS configuration is typically done via Supabase Dashboard, not SQL
-- Dashboard: https://supabase.com/dashboard/project/gtudnbdtcvmzsvrzvdoz/storage

-- However, we can verify the bucket configuration
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'project-files';

-- If you need to update bucket settings, use the Dashboard:
-- Storage → project-files → Configuration → Edit CORS
