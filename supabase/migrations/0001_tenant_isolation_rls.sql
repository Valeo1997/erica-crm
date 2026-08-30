-- Drop whatever policies currently exist on these tables (their exact
-- names are unknown from the client — this discovers and drops them
-- generically instead of guessing).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plumbing_leads'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.plumbing_leads', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'crm_sub_accounts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.crm_sub_accounts', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sub_account_users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sub_account_users', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.sub_account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plumbing_leads ENABLE ROW LEVEL SECURITY;

-- A user can see their own membership row(s). This is what the EXISTS
-- subqueries below rely on: RLS runs as the querying user, so this
-- subquery only ever "sees" that user's own rows.
CREATE POLICY "users read own membership" ON public.sub_account_users
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tenant isolation select" ON public.crm_sub_accounts
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = crm_sub_accounts.sub_account_id
      AND su.user_id = auth.uid()
  )
);

CREATE POLICY "tenant isolation select" ON public.plumbing_leads
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = plumbing_leads.sub_account_id
      AND su.user_id = auth.uid()
  )
);

-- Covers future writes (e.g. persisting pipeline drag-and-drop stage
-- changes); the app doesn't perform any UPDATE yet, but the surface
-- should be closed by default rather than left open.
CREATE POLICY "tenant isolation update" ON public.plumbing_leads
FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = plumbing_leads.sub_account_id
      AND su.user_id = auth.uid()
  )
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = plumbing_leads.sub_account_id
      AND su.user_id = auth.uid()
  )
);
