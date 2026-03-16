-- Add parent_id support for sub-category hierarchy
-- Allow categories to have parent-child relationships

-- Add parent_id column to enable tree structure
ALTER TABLE public.project_categories
ADD COLUMN parent_id UUID REFERENCES public.project_categories(id) ON DELETE SET NULL;

-- Update unique constraint to allow same name in different parent categories
-- Drop the old constraint (not the index)
ALTER TABLE public.project_categories
DROP CONSTRAINT IF EXISTS project_categories_project_id_name_key;

-- Create new unique constraint that includes parent_id
-- NULL parent_id means top-level, which should still have unique names within a project
CREATE UNIQUE INDEX project_categories_project_id_parent_id_name_key
ON public.project_categories(project_id, COALESCE(parent_id, ('00000000-0000-0000-0000-000000000000'::uuid)), name);

-- Add index for efficient tree queries
CREATE INDEX project_categories_parent_id_idx ON public.project_categories(parent_id);

-- Add comment to explain the hierarchy
COMMENT ON COLUMN public.project_categories.parent_id IS 'Parent category ID for sub-categories. NULL means top-level category.';
