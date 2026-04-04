-- Create user_project_preferences table for SPEC-PROJ-001
-- This table stores user-specific project ordering and default project preferences

CREATE TABLE user_project_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, project_id),
  CONSTRAINT check_only_one_default UNIQUE (user_id, is_default) WHERE is_default = true
);

-- Performance indexes
CREATE INDEX idx_user_project_prefs_user_id ON user_project_preferences(user_id);
CREATE INDEX idx_user_project_prefs_project_id ON user_project_preferences(project_id);
CREATE INDEX idx_user_project_prefs_display_order ON user_project_preferences(user_id, display_order);

-- RLS Policies
ALTER TABLE user_project_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project preferences"
  ON user_project_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project preferences"
  ON user_project_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project preferences"
  ON user_project_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own project preferences"
  ON user_project_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Updated trigger for updated_at
CREATE TRIGGER update_user_project_preferences_updated_at
  BEFORE UPDATE ON user_project_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
