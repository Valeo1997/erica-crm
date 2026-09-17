-- Contacts + Companies foundation (docs/ARCHITECTURE.md — this CRM is the
-- system of record). Tenant isolation matches 0001_tenant_isolation_rls.sql:
-- every row carries sub_account_id and the RLS predicate is the same
-- admin-or-membership check used for plumbing_leads. Unlike plumbing_leads
-- these tables are written from the app, so INSERT and DELETE policies are
-- included alongside SELECT and UPDATE.
-- Idempotent: safe to run more than once from the SQL editor.

CREATE TABLE IF NOT EXISTS public.companies (
  company_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id  uuid NOT NULL REFERENCES public.crm_sub_accounts (sub_account_id),
  name            text NOT NULL,
  industry        text,
  website         text,
  phone           text,
  address         text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  contact_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id  uuid NOT NULL REFERENCES public.crm_sub_accounts (sub_account_id),
  company_id      uuid REFERENCES public.companies (company_id) ON DELETE SET NULL,
  first_name      text NOT NULL,
  last_name       text,
  email           text,
  phone           text,
  title           text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_sub_account_id_idx
  ON public.companies (sub_account_id);
CREATE INDEX IF NOT EXISTS contacts_sub_account_id_idx
  ON public.contacts (sub_account_id);
CREATE INDEX IF NOT EXISTS contacts_company_id_idx
  ON public.contacts (company_id);

-- Keep updated_at honest on edits.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS companies_set_updated_at ON public.companies;
CREATE TRIGGER companies_set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS contacts_set_updated_at ON public.contacts;
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation select" ON public.companies;
CREATE POLICY "tenant isolation select" ON public.companies
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = companies.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation insert" ON public.companies;
CREATE POLICY "tenant isolation insert" ON public.companies
FOR INSERT WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = companies.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation update" ON public.companies;
CREATE POLICY "tenant isolation update" ON public.companies
FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = companies.sub_account_id
      AND su.user_id = auth.uid()
  )
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = companies.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation delete" ON public.companies;
CREATE POLICY "tenant isolation delete" ON public.companies
FOR DELETE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = companies.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation select" ON public.contacts;
CREATE POLICY "tenant isolation select" ON public.contacts
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = contacts.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation insert" ON public.contacts;
CREATE POLICY "tenant isolation insert" ON public.contacts
FOR INSERT WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = contacts.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation update" ON public.contacts;
CREATE POLICY "tenant isolation update" ON public.contacts
FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = contacts.sub_account_id
      AND su.user_id = auth.uid()
  )
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = contacts.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation delete" ON public.contacts;
CREATE POLICY "tenant isolation delete" ON public.contacts
FOR DELETE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = contacts.sub_account_id
      AND su.user_id = auth.uid()
  )
);
