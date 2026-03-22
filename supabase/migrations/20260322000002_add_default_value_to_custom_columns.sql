-- Add default_value column to custom_columns table
ALTER TABLE public.custom_columns ADD COLUMN IF NOT EXISTS default_value TEXT;
