
ALTER TABLE public.transactions
ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Add index for filtering soft-deleted rows
CREATE INDEX idx_transactions_deleted_at ON public.transactions (deleted_at);

-- Allow owners to update any transaction in their project (for restore)
CREATE POLICY "Owners can update project transactions"
ON public.transactions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = transactions.project_id
    AND projects.owner_id = auth.uid()
  )
);

-- Allow owners to select deleted transactions
-- (existing SELECT policy already covers members viewing project transactions)
