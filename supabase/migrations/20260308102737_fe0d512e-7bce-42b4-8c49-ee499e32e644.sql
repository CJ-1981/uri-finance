-- Allow owners to update member roles (for promoting to admin)
CREATE POLICY "Owners can update member roles"
ON public.project_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_members.project_id
    AND projects.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_members.project_id
    AND projects.owner_id = auth.uid()
  )
);