
-- Individual invite codes table
CREATE TABLE public.project_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code text NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  label text, -- optional label like "for 김목사님"
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(code)
);

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- Members can view invites for their project
CREATE POLICY "Members can view invites"
  ON public.project_invites FOR SELECT
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

-- Members can create invites (owner check in app)
CREATE POLICY "Members can create invites"
  ON public.project_invites FOR INSERT
  TO authenticated
  WITH CHECK (is_project_member(auth.uid(), project_id) AND auth.uid() = created_by);

-- Owners can delete invites
CREATE POLICY "Owners can delete invites"
  ON public.project_invites FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_invites.project_id AND projects.owner_id = auth.uid()));

-- Allow updating used_by when joining
CREATE POLICY "Anyone can claim unused invite"
  ON public.project_invites FOR UPDATE
  TO authenticated
  USING (used_by IS NULL)
  WITH CHECK (auth.uid() = used_by);

-- Ban list table
CREATE TABLE public.project_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bans"
  ON public.project_bans FOR SELECT
  TO authenticated
  USING (is_project_member(auth.uid(), project_id));

CREATE POLICY "Owners can ban"
  ON public.project_bans FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_bans.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Owners can unban"
  ON public.project_bans FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_bans.project_id AND projects.owner_id = auth.uid()));

-- Anyone can look up invite by code (for joining)
CREATE POLICY "Anyone can find invite by code"
  ON public.project_invites FOR SELECT
  TO authenticated
  USING (true);
