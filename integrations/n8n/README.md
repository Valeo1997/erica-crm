# n8n integrations — import & setup runbook

Two workflows that connect the CRM to the outside world. Everything here is
human setup — the code is done. Work through top to bottom.

| Workflow | File | Direction | Purpose |
|---|---|---|---|
| Call feed | `ericka-call-feed-crm.json` | ElevenLabs → Supabase | Every answered call becomes a `plumbing_leads` row |
| Stage sync | `ghl-stage-sync.json` | GHL → Supabase | Pipeline stage changes in GHL mirror into the CRM |
| Booking tools | `booking-tools.json` | ElevenLabs → Supabase | Mid-call check / book / cancel against `booking_slots` |
| Nightly slots | `booking-nightly-ensure-slots.json` | n8n cron → Supabase | Keeps a rolling 21-day window horizon per tenant |

## 1. Database first (one time)

Supabase dashboard → SQL Editor → paste the contents of
`supabase/migrations/0002_ghl_sync.sql` → Run. It is idempotent (safe to
re-run). Creates the event inbox, the stage map, and the idempotency indexes.

## 2. Get the service_role key (one time)

Supabase dashboard → **Settings → API Keys** → copy the **service_role**
secret.

This is the god-mode key. It is used **only** inside these two n8n workflows
(server-side) — never in the browser app, never in a chat, never committed to
git. If it ever leaks, rotate it in the same dashboard screen and update the
two workflows.

## 3. Import the workflows

n8n cloud → Workflows → **Import from File** → pick each JSON. In each
workflow open the single **Code node** and replace the placeholders at the
top:

- `PASTE_PROJECT_URL_HERE` → `https://phtmarvmovozydxipmat.supabase.co`
- `PASTE_SERVICE_ROLE_KEY_HERE` → the service_role key from step 2
- (`ghl-stage-sync` only) `PASTE_SHARED_SECRET_HERE` → any long random
  string you invent; you'll reuse it in step 5

**Activate** each workflow (toggle top-right). Activation is what creates the
production webhook URL — copy it from the Webhook node:

- `https://nvme.app.n8n.cloud/webhook/ericka-call-feed-crm`
- `https://nvme.app.n8n.cloud/webhook/ghl-stage-sync`

## 4. ElevenLabs (call feed)

Per agent, in the ElevenLabs dashboard:

1. Set the **post-call webhook** to the call-feed URL above.
2. Make sure each client's agent passes **`sub_account_id`** (dynamic
   variable or data-collection field) — that is how a call gets attributed to
   the right business. No `sub_account_id` → the workflow refuses the call by
   design, so a misconfigured agent can't pollute other tenants' data.

## 5. GHL (stage sync) — per sub-account

In the GHL sub-account, create/edit a Workflow:

1. **Trigger:** opportunity stage changed (add "opportunity status changed"
   too if your plan splits them).
2. **Action:** *Custom Webhook* →
   - URL: the `ghl-stage-sync` production URL above
   - Header: `X-Mirror-Key: <the MIRROR_KEY you invented in step 3>`
   - Body fields (merge values): `locationId`, `opportunity.id`,
     `opportunity.pipeline_id`, `opportunity.stage_id`, `opportunity.status`,
     `opportunity.updated_at`, plus contact first/last name, phone, address.
3. Fill the stage map so stages mirror correctly — in the Supabase SQL
   editor, one row per GHL stage:

   ```sql
   insert into public.ghl_stage_map (sub_account_id, ghl_pipeline_id, ghl_stage_id, pipeline_stage)
   values
     ('<sub_account_id>', '<pipeline_id>', '<stage_id_1>', 'incoming'),
     ('<sub_account_id>', '<pipeline_id>', '<stage_id_2>', 'active'),
     ('<sub_account_id>', '<pipeline_id>', '<stage_id_3>', 'booked');
   ```

   (Stage/pipeline IDs: GHL → Opportunities → pipeline settings, or from the
   workflow trigger's test data.)

## 6. Test both directions

1. **Call feed:** run a test call through an agent → a row appears in
   `plumbing_leads` with transcript and `pipeline_stage = incoming`.
2. **Stage sync:** move that opportunity in GHL → within seconds the CRM
   pipeline shows the new stage.
3. **Idempotency:** refire either webhook (n8n → Executions → re-run) → no
   duplicate rows, stage unchanged.

## 7. Booking workflows (migration 0005 first)

Design: `docs/BOOKING.md`. Apply `supabase/migrations/0005_booking_slots.sql`
in the SQL editor before importing these two.

**`booking-nightly-ensure-slots.json`** — schedule trigger → Code node that
calls `ensure_slots` for every tenant. After import, **verify the schedule**
in the trigger node (03:17 nightly; re-save the cron if the import doesn't
map it). Activate it — without it, `book_slot` starts returning
"window full or missing" once the seeded horizon runs out.

**`booking-tools.json`** — webhook (`/webhook/ericka-booking-tools`,
response mode "last node" so Ericka gets the result synchronously mid-call).
Same placeholder convention (`PASTE_PROJECT_URL_HERE`,
`PASTE_SERVICE_ROLE_KEY_HERE`, `PASTE_SHARED_SECRET_HERE`); use the same
MIRROR_KEY as the stage sync. In ElevenLabs, configure the agent's tool as a
webhook POSTing to the production URL with header
`X-Mirror-Key: <MIRROR_KEY>` and JSON body:

- `{"action":"check","sub_account_id":"...","days":7}` → `{open:[{date,window,spots}]}`
- `{"action":"book","sub_account_id":"...","slot_date":"YYYY-MM-DD","window":"morning","customer_name":"...","customer_phone":"...","lead_id":"..."}` → `{booked:true,appointment_id}` or `{booked:false,reason:"window_full_or_missing"}`
- `{"action":"cancel","sub_account_id":"...","appointment_id":"..."}` → `{cancelled:true}`

Ericka must only offer windows returned by `check`.

## 8. Password-reset emails (one time, finishes the auth flow)

Supabase dashboard → **Authentication → URL Configuration**:

- Site URL: `https://erica-crm-rose.vercel.app`
- Redirect URLs — add:
  - `https://erica-crm-rose.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (for local testing)

Without this, reset links in the forgot-password email land on an error page.

## What is deliberately NOT here

- **No write-back to GHL.** The CRM is a mirror; booking/editing stays in
  GHL (docs/ARCHITECTURE.md).
- **Outbound automations** (SMS on emergency, follow-ups) are future n8n
  workflows triggered by Supabase database webhooks — separate build, after
  these two are proven in production.
