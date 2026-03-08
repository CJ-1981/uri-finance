
CREATE OR REPLACE FUNCTION public.get_db_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'db_size', pg_database_size(current_database()),
    'db_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'tables', (
      SELECT json_agg(json_build_object(
        'table_name', t.table_name,
        'row_count', (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name),
        'size', pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)))
      ))
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    )
  ) INTO result;
  RETURN result;
END;
$$;
