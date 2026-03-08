CREATE POLICY "Members can update custom columns"
ON public.custom_columns
FOR UPDATE
USING (is_project_member(auth.uid(), project_id))
WITH CHECK (is_project_member(auth.uid(), project_id));