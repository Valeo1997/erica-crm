-- CRM owns pipeline_stage (docs/ARCHITECTURE.md, 2026-09-05 pivot): the enum
-- widens from the mirror triple to the five CRM stages, leads link to
-- contacts, and tenant members can update leads from the app.
-- Old → new: incoming → new_lead, active → contacted, booked → closed_won.
-- Idempotent: safe to run more than once from the SQL editor.

-- a. Lead → contact link ----------------------------------------------------
ALTER TABLE public.plumbing_leads
  ADD COLUMN IF NOT EXISTS contact_id uuid
    REFERENCES public.contacts (contact_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS plumbing_leads_contact_id_idx
  ON public.plumbing_leads (contact_id);

-- b. Backfill contacts from lead phones --------------------------------------
-- Phones are a linking heuristic, not an identity: normalize to digits-only,
-- last 10, skip empties. One contact per (sub_account_id, normalized phone);
-- the representative row is the earliest lead (deterministic). Re-runs insert
-- nothing when a contact with that phone already exists in the sub-account.
WITH src AS (
  SELECT DISTINCT ON (
    l.sub_account_id,
    right(regexp_replace(coalesce(l.customer_phone, ''), '\D', '', 'g'), 10)
  )
    l.sub_account_id,
    right(regexp_replace(coalesce(l.customer_phone, ''), '\D', '', 'g'), 10) AS phone10,
    l.customer_name,
    l.customer_phone
  FROM public.plumbing_leads l
  WHERE right(regexp_replace(coalesce(l.customer_phone, ''), '\D', '', 'g'), 10) <> ''
  ORDER BY
    l.sub_account_id,
    right(regexp_replace(coalesce(l.customer_phone, ''), '\D', '', 'g'), 10),
    l.created_at,
    l.lead_id
)
INSERT INTO public.contacts (sub_account_id, first_name, last_name, phone)
SELECT
  s.sub_account_id,
  coalesce(nullif(split_part(s.customer_name, ' ', 1), ''), 'Unknown'),
  nullif(btrim(substr(s.customer_name, length(split_part(s.customer_name, ' ', 1)) + 1)), ''),
  s.customer_phone
FROM src s
WHERE NOT EXISTS (
  SELECT 1 FROM public.contacts c
  WHERE c.sub_account_id = s.sub_account_id
    AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) = s.phone10
);

-- Link unlinked leads to their phone-matched contact. If several contacts in
-- the sub-account share the normalized phone (possible when one pre-existed
-- the backfill), the earliest created wins — deterministic.
UPDATE public.plumbing_leads l
SET contact_id = (
  SELECT c.contact_id
  FROM public.contacts c
  WHERE c.sub_account_id = l.sub_account_id
    AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10)
      = right(regexp_replace(coalesce(l.customer_phone, ''), '\D', '', 'g'), 10)
  ORDER BY c.created_at, c.contact_id
  LIMIT 1
)
WHERE l.contact_id IS NULL
  AND right(regexp_replace(coalesce(l.customer_phone, ''), '\D', '', 'g'), 10) <> '';

-- c. Stage enum widening -----------------------------------------------------
-- plumbing_leads predates the migrations, so its CHECK name is unknown —
-- discover and drop any CHECK mentioning pipeline_stage generically.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.plumbing_leads'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%pipeline_stage%'
  LOOP
    EXECUTE format('ALTER TABLE public.plumbing_leads DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

UPDATE public.plumbing_leads
SET pipeline_stage = CASE pipeline_stage
  WHEN 'incoming' THEN 'new_lead'
  WHEN 'active'   THEN 'contacted'
  WHEN 'booked'   THEN 'closed_won'
  ELSE pipeline_stage
END
WHERE pipeline_stage IN ('incoming', 'active', 'booked');

ALTER TABLE public.plumbing_leads
  ADD CONSTRAINT plumbing_leads_pipeline_stage_check
  CHECK (pipeline_stage IN ('new_lead', 'contacted', 'qualified', 'proposal_sent', 'closed_won'));

-- ghl_stage_map targets the same enum so the still-running GHL sync (which
-- writes via the service role) keeps working through the transition.
ALTER TABLE public.ghl_stage_map
  DROP CONSTRAINT IF EXISTS ghl_stage_map_pipeline_stage_check;

UPDATE public.ghl_stage_map
SET pipeline_stage = CASE pipeline_stage
  WHEN 'incoming' THEN 'new_lead'
  WHEN 'active'   THEN 'contacted'
  WHEN 'booked'   THEN 'closed_won'
  ELSE pipeline_stage
END
WHERE pipeline_stage IN ('incoming', 'active', 'booked');

ALTER TABLE public.ghl_stage_map
  ADD CONSTRAINT ghl_stage_map_pipeline_stage_check
  CHECK (pipeline_stage IN ('new_lead', 'contacted', 'qualified', 'proposal_sent', 'closed_won'));

-- d. Tenant members can update leads (stage, contact link) from the app ------
-- The CRM is the system of record now; the mirror-era "service role writes
-- only" model is dead. Same predicate as the SELECT policy in 0001. 0001
-- already creates this policy — recreated here so the write surface exists
-- even on databases where 0001's UPDATE policy was never applied or dropped.
DROP POLICY IF EXISTS "tenant isolation update" ON public.plumbing_leads;
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
