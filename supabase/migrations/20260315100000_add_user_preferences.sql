-- ============================================================
-- Migration: Add user_preferences table
-- Purpose: Server-side persistence of user project selection
-- SPEC: SPEC-PERSIST-001
-- ============================================================

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row-Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own preferences only
CREATE POLICY "Users can manage own preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id);

-- Create performance index
CREATE INDEX idx_user_preferences_user
  ON public.user_preferences(user_id);

-- Create or replace the auto-update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to clear default_project_id when user is removed from project
CREATE OR REPLACE FUNCTION public.clear_project_preference_on_removal()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_preferences
  SET default_project_id = NULL
  WHERE user_id = OLD.user_id
    AND default_project_id = OLD.project_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clear_preference_on_member_removal
  AFTER DELETE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_project_preference_on_removal();

-- Add comment for documentation
COMMENT ON TABLE public.user_preferences IS 'User preferences including default project selection';
COMMENT ON COLUMN public.user_preferences.user_id IS 'Reference to auth.users table';
COMMENT ON COLUMN public.user_preferences.default_project_id IS 'User selected default project';
