-- GHL → Supabase sync support (docs/GHL_SYNC.md).
-- Idempotent: safe to run more than once from the SQL editor.

-- Ordering guard for out-of-order GHL deliveries: the sync only applies a
-- stage change when the event's source timestamp is newer than this value.
ALTER TABLE public.plumbing_leads
  ADD COLUMN IF NOT EXISTS ghl_synced_at timestamptz;

-- Idempotency keys. Call-feed upserts dedupe on call_id; GHL sync upserts
-- dedupe on ghl_opportunity_id. These must be FULL unique indexes: PostgREST
-- upserts (on_conflict=) cannot match partial indexes, and Postgres allows
-- multiple NULLs regardless, so the old WHERE clauses bought nothing and
-- broke every upsert with 42P10. (Applied to the live DB as equivalent
-- unique constraints under the same names.)
CREATE UNIQUE INDEX IF NOT EXISTS plumbing_leads_call_id_key
  ON public.plumbing_leads (call_id);

CREATE UNIQUE INDEX IF NOT EXISTS plumbing_leads_ghl_opportunity_id_key
  ON public.plumbing_leads (ghl_opportunity_id);

-- Inbox: every inbound GHL webhook delivery, written before any processing.
-- Service role only — RLS enabled with no policies = no end-user access.
CREATE TABLE IF NOT EXISTS public.ghl_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key     text NOT NULL,
  location_id   text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'received',
  error         text,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ghl_events_event_key_key
  ON public.ghl_events (event_key);

-- GHL stage IDs are per-pipeline, per-account, and renamable — never infer
-- the mirror stage from a stage name, always from this map.
CREATE TABLE IF NOT EXISTS public.ghl_stage_map (
  sub_account_id  uuid NOT NULL REFERENCES public.crm_sub_accounts (sub_account_id),
  ghl_pipeline_id text NOT NULL,
  ghl_stage_id    text NOT NULL,
  pipeline_stage  text NOT NULL CHECK (pipeline_stage IN ('incoming', 'active', 'booked')),
  PRIMARY KEY (ghl_pipeline_id, ghl_stage_id)
);

ALTER TABLE public.ghl_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghl_stage_map ENABLE ROW LEVEL SECURITY;
