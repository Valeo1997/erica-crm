-- 0006: security and performance hardening from the Nov 23 2026 audit.
-- NOT APPLIED automatically. Review, then run once in the Supabase SQL editor
-- (or apply_migration). Every statement is reversible and idempotent; nothing
-- here deletes data.
--
-- What it does
--   1. Takes table rights away from the anonymous role. No RLS policy grants
--      anon anything, so nothing that works today stops working; this only
--      removes the blast radius if a policy is ever written wrong.
--   2. Stops anon/authenticated from calling the SECURITY DEFINER trigger
--      function directly (triggers still fire; EXECUTE is not checked then).
--      cancel_appointment keeps its authenticated grant: the CRM calls it.
--   3. Rewrites the RLS policies to evaluate auth.uid()/auth.jwt() once per
--      query instead of once per row (Supabase advisor auth_rls_initplan).
--      Same rules, same roles; only the evaluation changes.
--   4. Indexes the unindexed foreign keys and drops the duplicate UNIQUE
--      constraint on booking_slots (an identical one remains).

BEGIN;

-- 1. anon table rights ------------------------------------------------------
REVOKE ALL ON TABLE
  public.crm_sub_accounts,
  public.sub_account_users,
  public.plumbing_leads,
  public.ghl_events,
  public.ghl_stage_map,
  public.companies,
  public.contacts,
  public.booking_slots,
  public.appointments
FROM anon;

-- authenticated never needs TRUNCATE / REFERENCES / TRIGGER from the browser.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.crm_sub_accounts,
  public.sub_account_users,
  public.plumbing_leads,
  public.ghl_events,
  public.ghl_stage_map,
  public.companies,
  public.contacts,
  public.booking_slots,
  public.appointments
FROM authenticated;

-- 2. function execute rights ------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.link_appointments_to_new_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment(uuid) FROM PUBLIC, anon;

-- 3. RLS policies: evaluate auth once per query -----------------------------
-- Admin check kept exactly as each table had it.
DROP POLICY IF EXISTS "tenant isolation select" ON public.crm_sub_accounts;
CREATE POLICY "tenant isolation select" ON public.crm_sub_accounts
  FOR SELECT USING (
    ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
    OR EXISTS (SELECT 1 FROM public.sub_account_users su
               WHERE su.sub_account_id = crm_sub_accounts.sub_account_id
                 AND su.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "users read own membership" ON public.sub_account_users;
CREATE POLICY "users read own membership" ON public.sub_account_users
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "tenant isolation select" ON public.plumbing_leads;
CREATE POLICY "tenant isolation select" ON public.plumbing_leads
  FOR SELECT USING (
    ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
    OR EXISTS (SELECT 1 FROM public.sub_account_users su
               WHERE su.sub_account_id = plumbing_leads.sub_account_id
                 AND su.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "tenant isolation update" ON public.plumbing_leads;
CREATE POLICY "tenant isolation update" ON public.plumbing_leads
  FOR UPDATE USING (
    ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
    OR EXISTS (SELECT 1 FROM public.sub_account_users su
               WHERE su.sub_account_id = plumbing_leads.sub_account_id
                 AND su.user_id = (SELECT auth.uid())))
  WITH CHECK (
    ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
    OR EXISTS (SELECT 1 FROM public.sub_account_users su
               WHERE su.sub_account_id = plumbing_leads.sub_account_id
                 AND su.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "tenant isolation select" ON public.booking_slots;
CREATE POLICY "tenant isolation select" ON public.booking_slots
  FOR SELECT TO authenticated USING (
    ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin') = 'true')
    OR EXISTS (SELECT 1 FROM public.sub_account_users su
               WHERE su.sub_account_id = booking_slots.sub_account_id
                 AND su.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "tenant isolation select" ON public.appointments;
CREATE POLICY "tenant isolation select" ON public.appointments
  FOR SELECT TO authenticated USING (
    ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin') = 'true')
    OR EXISTS (SELECT 1 FROM public.sub_account_users su
               WHERE su.sub_account_id = appointments.sub_account_id
                 AND su.user_id = (SELECT auth.uid())));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies', 'contacts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant isolation select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant isolation insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant isolation update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant isolation delete" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "tenant isolation select" ON public.%1$I FOR SELECT USING (
      ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
      OR EXISTS (SELECT 1 FROM public.sub_account_users su
                 WHERE su.sub_account_id = %1$I.sub_account_id AND su.user_id = (SELECT auth.uid()))))$p$, t);
    EXECUTE format($p$CREATE POLICY "tenant isolation insert" ON public.%1$I FOR INSERT WITH CHECK (
      ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
      OR EXISTS (SELECT 1 FROM public.sub_account_users su
                 WHERE su.sub_account_id = %1$I.sub_account_id AND su.user_id = (SELECT auth.uid()))))$p$, t);
    EXECUTE format($p$CREATE POLICY "tenant isolation update" ON public.%1$I FOR UPDATE USING (
      ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
      OR EXISTS (SELECT 1 FROM public.sub_account_users su
                 WHERE su.sub_account_id = %1$I.sub_account_id AND su.user_id = (SELECT auth.uid()))))
      WITH CHECK (
      ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
      OR EXISTS (SELECT 1 FROM public.sub_account_users su
                 WHERE su.sub_account_id = %1$I.sub_account_id AND su.user_id = (SELECT auth.uid()))))$p$, t);
    EXECUTE format($p$CREATE POLICY "tenant isolation delete" ON public.%1$I FOR DELETE USING (
      ((((SELECT auth.jwt()) -> 'app_metadata') ->> 'is_admin')::boolean IS TRUE)
      OR EXISTS (SELECT 1 FROM public.sub_account_users su
                 WHERE su.sub_account_id = %1$I.sub_account_id AND su.user_id = (SELECT auth.uid()))))$p$, t);
  END LOOP;
END $$;

-- 4. indexes ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS appointments_lead_id_idx ON public.appointments (lead_id);
CREATE INDEX IF NOT EXISTS appointments_sub_account_slot_idx ON public.appointments (sub_account_id, slot_id);
CREATE INDEX IF NOT EXISTS plumbing_leads_sub_account_id_idx ON public.plumbing_leads (sub_account_id);
CREATE INDEX IF NOT EXISTS ghl_stage_map_sub_account_id_idx ON public.ghl_stage_map (sub_account_id);
-- Phone lookups for the booking tool's double-booking guard.
CREATE INDEX IF NOT EXISTS appointments_phone_booked_idx
  ON public.appointments (sub_account_id, customer_phone) WHERE status = 'booked';

-- Identical to booking_slots_sub_account_id_slot_date_window_key; nothing references it.
ALTER TABLE public.booking_slots DROP CONSTRAINT IF EXISTS booking_slots_one_row_per_day_window;

COMMIT;
