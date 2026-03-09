
CREATE OR REPLACE FUNCTION public.rename_custom_column_key(
  _project_id uuid,
  _old_name text,
  _new_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.transactions
  SET custom_values = (custom_values - _old_name) || jsonb_build_object(_new_name, custom_values -> _old_name)
  WHERE project_id = _project_id
    AND deleted_at IS NULL
    AND custom_values ? _old_name;
END;
$$;
