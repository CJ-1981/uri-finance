
-- Project categories table
CREATE TABLE public.project_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project categories"
  ON public.project_categories FOR SELECT
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can add categories"
  ON public.project_categories FOR INSERT
  TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can delete categories"
  ON public.project_categories FOR DELETE
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can update categories"
  ON public.project_categories FOR UPDATE
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- Function to seed default categories when a project is created
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

CREATE TRIGGER on_project_created_seed_categories
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_project_categories();
