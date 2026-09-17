-- Booking engine: booking_slots IS the calendar (docs/BOOKING.md). Replaces
-- GHL's calendar role per the 2026-09-05 pivot. Three fixed windows per day
-- (morning/midday/late_afternoon, default caps 3/2/3), atomic booking via
-- RPC so concurrent calls can't oversell a window.
-- One timezone: America/Phoenix (no DST) — dates are anchored to it inside
-- ensure_slots so UTC server time can't shift "today".
-- Idempotent: safe to run more than once from the SQL editor.
--
-- APPLIED VERSION NOTE (2026-09-12): this migration was applied to the live DB
-- via the Supabase SQL editor's AI assistant, which hardened it beyond this
-- file: quoted "window" (reserved keyword — fixed here too), a tenant-safe
-- composite slot/appointment FK, authenticated read-only policies (writes via
-- service-role RPCs only), safer admin-claim handling, p_days_ahead 0–366
-- validation, and extra capacity/booked-count constraints. The LIVE DATABASE
-- is authoritative; if its final SQL is exported, sync this file to match.

-- a. booking_slots -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_slots (
  slot_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id  uuid NOT NULL REFERENCES public.crm_sub_accounts (sub_account_id),
  slot_date       date NOT NULL,
  "window"        text NOT NULL CHECK ("window" IN ('morning', 'midday', 'late_afternoon')),
  capacity        int NOT NULL,
  booked_count    int NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, slot_date, "window")
);

-- b. appointments ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  appointment_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id  uuid NOT NULL REFERENCES public.crm_sub_accounts (sub_account_id),
  slot_id         uuid NOT NULL REFERENCES public.booking_slots (slot_id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES public.plumbing_leads (lead_id) ON DELETE SET NULL,
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show')),
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_sub_account_id_status_idx
  ON public.appointments (sub_account_id, status);
CREATE INDEX IF NOT EXISTS appointments_slot_id_idx
  ON public.appointments (slot_id);

DROP TRIGGER IF EXISTS booking_slots_set_updated_at ON public.booking_slots;
CREATE TRIGGER booking_slots_set_updated_at
  BEFORE UPDATE ON public.booking_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- c. book_slot: atomic counter + appointment ---------------------------------
-- The UPDATE ... booked_count < capacity is the whole race guard: two
-- concurrent calls can't both pass the check on the last open spot. Returns
-- the new appointment_id, or NULL when the window is full or doesn't exist.
CREATE OR REPLACE FUNCTION public.book_slot(
  p_sub_account_id uuid,
  p_slot_date      date,
  p_window         text,
  p_customer_name  text,
  p_customer_phone text DEFAULT '',
  p_lead_id        uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id uuid;
  v_appointment_id uuid;
BEGIN
  UPDATE public.booking_slots
  SET booked_count = booked_count + 1
  WHERE sub_account_id = p_sub_account_id
    AND slot_date = p_slot_date
    AND "window" = p_window
    AND booked_count < capacity
  RETURNING slot_id INTO v_slot_id;

  IF v_slot_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.appointments
    (sub_account_id, slot_id, lead_id, customer_name, customer_phone)
  VALUES
    (p_sub_account_id, v_slot_id, p_lead_id, p_customer_name, p_customer_phone)
  RETURNING appointment_id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

-- d. release_slot: cancel + decrement, atomically -----------------------------
-- Only a 'booked' appointment can be released, so repeat calls are no-ops
-- and the count can't double-decrement. Returns true when it cancelled.
CREATE OR REPLACE FUNCTION public.release_slot(p_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id uuid;
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled'
  WHERE appointment_id = p_appointment_id
    AND status = 'booked'
  RETURNING slot_id INTO v_slot_id;

  IF v_slot_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.booking_slots
  SET booked_count = greatest(booked_count - 1, 0)
  WHERE slot_id = v_slot_id;

  RETURN true;
END;
$$;

-- e. ensure_slots: keep the rolling window of days provisioned ----------------
-- Nightly n8n job calls this per tenant. Dates anchored to America/Phoenix.
CREATE OR REPLACE FUNCTION public.ensure_slots(
  p_sub_account_id uuid,
  p_days_ahead int DEFAULT 21
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Phoenix')::date;
BEGIN
  INSERT INTO public.booking_slots (sub_account_id, slot_date, "window", capacity)
  SELECT
    p_sub_account_id,
    v_today + offs.day,
    w."window",
    w.capacity
  FROM generate_series(0, p_days_ahead) AS offs (day)
  CROSS JOIN (
    VALUES ('morning', 3), ('midday', 2), ('late_afternoon', 3)
  ) AS w ("window", capacity)
  ON CONFLICT (sub_account_id, slot_date, "window") DO NOTHING;
END;
$$;

-- RPCs run as the function owner and bypass RLS — only the service role
-- (n8n) may execute them. Tenant users get plain table RLS instead.
REVOKE ALL ON FUNCTION public.book_slot(uuid, date, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_slot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_slots(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, date, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_slot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_slots(uuid, int) TO service_role;

-- RLS: same admin-or-membership predicate as 0003's tables -------------------
ALTER TABLE public.booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation select" ON public.booking_slots;
CREATE POLICY "tenant isolation select" ON public.booking_slots
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = booking_slots.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation insert" ON public.booking_slots;
CREATE POLICY "tenant isolation insert" ON public.booking_slots
FOR INSERT WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = booking_slots.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation update" ON public.booking_slots;
CREATE POLICY "tenant isolation update" ON public.booking_slots
FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = booking_slots.sub_account_id
      AND su.user_id = auth.uid()
  )
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = booking_slots.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation delete" ON public.booking_slots;
CREATE POLICY "tenant isolation delete" ON public.booking_slots
FOR DELETE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = booking_slots.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation select" ON public.appointments;
CREATE POLICY "tenant isolation select" ON public.appointments
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = appointments.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation insert" ON public.appointments;
CREATE POLICY "tenant isolation insert" ON public.appointments
FOR INSERT WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = appointments.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation update" ON public.appointments;
CREATE POLICY "tenant isolation update" ON public.appointments
FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = appointments.sub_account_id
      AND su.user_id = auth.uid()
  )
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = appointments.sub_account_id
      AND su.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tenant isolation delete" ON public.appointments;
CREATE POLICY "tenant isolation delete" ON public.appointments
FOR DELETE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = appointments.sub_account_id
      AND su.user_id = auth.uid()
  )
);

-- f. Seed the Ericka AI tenant (same uuid as the stage-map seed) --------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.crm_sub_accounts
    WHERE sub_account_id = 'f7827917-458a-4ce7-97e6-0cc623a968b1'
  ) THEN
    PERFORM public.ensure_slots('f7827917-458a-4ce7-97e6-0cc623a968b1'::uuid, 21);
  END IF;
END $$;
