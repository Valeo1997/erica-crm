-- Stage map seed: "Ericka AI Sales" pipeline (GHL location xS6XtHTWs9JzkVQk6iwk)
-- Maps GHL pipeline stages onto the mirror enum ('incoming' | 'active' | 'booked').
-- Design: docs/GHL_SYNC.md. Pipeline/stage IDs pulled from the GHL API 2026-09-03.
--
-- Prereqs:
--   1. supabase/migrations/0002_ghl_sync.sql has been applied.
--   2. Find the sub-account uuid for this GHL location:
--        SELECT sub_account_id, company_name FROM public.crm_sub_accounts;
--      (the same uuid the ElevenLabs agent attributes calls to)
--   3. Replace PASTE_SUB_ACCOUNT_UUID_HERE below and run. Idempotent — safe to re-run.
--
-- Deliberately unmapped: "Nurture" (4ea48994-81d4-42f8-bec9-583aaeead235).
-- Unmapped stages are skipped + logged; the lead keeps its last stage (§7).

WITH acct AS (
  SELECT 'PASTE_SUB_ACCOUNT_UUID_HERE'::uuid AS sub_account_id
)
INSERT INTO public.ghl_stage_map (sub_account_id, ghl_pipeline_id, ghl_stage_id, pipeline_stage)
SELECT acct.sub_account_id, v.ghl_pipeline_id, v.ghl_stage_id, v.pipeline_stage
FROM acct
JOIN (VALUES
  ('EHIVzZRHjq7mtpKUMOkZ', '1cc56fe8-d8ae-4ffd-9bf7-77d1845b1b21', 'incoming'), -- New Lead
  ('EHIVzZRHjq7mtpKUMOkZ', '48d9590b-2fd6-44d5-a45a-4acc2747f85a', 'active'),   -- Attempting Contact
  ('EHIVzZRHjq7mtpKUMOkZ', '094894a8-ff52-4458-b73f-6cfe61742690', 'active'),   -- Contacted
  ('EHIVzZRHjq7mtpKUMOkZ', 'a43ecf73-d6e4-4a08-8771-06ad8415b29a', 'active'),   -- Proposal Sent
  ('EHIVzZRHjq7mtpKUMOkZ', 'c692d140-18a1-4cf7-b2c7-23f4e677e0f5', 'booked'),   -- Demo Booked
  ('EHIVzZRHjq7mtpKUMOkZ', '5029149f-c303-4377-b7b8-f577a51fe62c', 'booked')    -- Closed
) AS v(ghl_pipeline_id, ghl_stage_id, pipeline_stage) ON true
ON CONFLICT (ghl_pipeline_id, ghl_stage_id) DO UPDATE
SET sub_account_id = EXCLUDED.sub_account_id,
    pipeline_stage = EXCLUDED.pipeline_stage;
