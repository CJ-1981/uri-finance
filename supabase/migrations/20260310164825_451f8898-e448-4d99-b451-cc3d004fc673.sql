
CREATE OR REPLACE FUNCTION public.remove_custom_column_key(_project_id uuid, _column_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.transactions
  SET custom_values = custom_values - _column_name
  WHERE project_id = _project_id
    AND deleted_at IS NULL
    AND custom_values ? _column_name;
END;
$$;
