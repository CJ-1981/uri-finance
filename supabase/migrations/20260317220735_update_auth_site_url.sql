-- Update Supabase Auth site URL and redirect URLs for GitHub Pages deployment
-- Base URL: https://cj-1981.github.io/uri-finance/

-- Skip this migration if auth.clients doesn't exist (managed by Supabase)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth'
    AND table_name = 'clients'
  ) THEN
    -- Update site_url
    UPDATE auth.clients
    SET site_url = 'https://cj-1981.github.io/uri-finance/'
    WHERE id = (SELECT id FROM auth.clients ORDER BY id LIMIT 1);

    -- Update redirect_urls to include auth callback path
    UPDATE auth.clients
    SET redirect_urls = '["https://cj-1981.github.io/uri-finance/**", "http://localhost:5173/**", "http://localhost:3000/**"]'
    WHERE id = (SELECT id FROM auth.clients ORDER BY id LIMIT 1);
  ELSE
    RAISE NOTICE 'auth.clients table does not exist - skipping. Update via Supabase Dashboard instead.';
  END IF;
END $$;

-- Note: Email templates must be updated manually in Supabase Dashboard
-- to point to: https://cj-1981.github.io/uri-finance/auth/callback
-- Dashboard URL: https://supabase.com/dashboard/project/gtudnbdtcvmzsvrzvdoz/auth/templates
