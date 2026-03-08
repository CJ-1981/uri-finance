
-- Table for defining custom numeric columns per project
CREATE TABLE public.custom_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view custom columns"
  ON public.custom_columns FOR SELECT
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can insert custom columns"
  ON public.custom_columns FOR INSERT
  TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can delete custom columns"
  ON public.custom_columns FOR DELETE
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- Add JSONB column to transactions for custom numeric values
ALTER TABLE public.transactions ADD COLUMN custom_values JSONB DEFAULT '{}'::jsonb;
