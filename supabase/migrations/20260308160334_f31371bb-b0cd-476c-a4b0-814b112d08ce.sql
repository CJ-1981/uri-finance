ALTER TABLE public.project_categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.custom_columns ADD COLUMN sort_order integer NOT NULL DEFAULT 0;