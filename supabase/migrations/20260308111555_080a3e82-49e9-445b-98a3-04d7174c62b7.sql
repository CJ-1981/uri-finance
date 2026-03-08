ALTER TABLE public.project_invites 
  ADD COLUMN email text DEFAULT NULL,
  ADD COLUMN role text NOT NULL DEFAULT 'member';