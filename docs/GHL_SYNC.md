# GHL → Supabase Sync Design

How GoHighLevel state flows into the mirror. GHL stays the system of record
(`docs/ARCHITECTURE.md`); this design is one-way, read-only at the CRM end,
and adds no write-back path.

Status: **partially implemented.** Transport is the n8n workflow in
`integrations/n8n/` (setup runbook in its README); schema is migration
`supabase/migrations/0002_ghl_sync.sql`. The voice stack already writes call
data to Supabase through n8n (the "Main Flow"), matching §1.

## 1. The two-writer model (read this first)

A `plumbing_leads` row is written by **two different systems, each owning a
disjoint set of columns**:

| Writer | Columns it owns | Columns it never touches |
|---|---|---|
| Ericka voice stack (call time) | `call_id`, `transcript`, `plumbing_issue`, `emergency_level`, `customer_*` (as heard on the call), `created_at` | `pipeline_stage`, `ghl_opportunity_id` |
| GHL sync (this design) | `pipeline_stage`, `ghl_opportunity_id`, `customer_*` corrections from the contact record | `call_id`, `transcript`, `plumbing_issue`, `emergency_level` |

This is the load-bearing decision. GHL knows nothing about transcripts or
emergency levels; the voice stack knows nothing about pipeline stages. The
sync never overwrites call data, and the voice stack never overwrites stage
data. The join key is `ghl_opportunity_id` (falling back to phone-number
matching only during the linking window — see §6).

Because the two writers touch disjoint columns, there is no conflict
resolution to design — only linking to get right.

## 2. What we subscribe to

Per GHL sub-account (location), three workflow triggers matter:

1. **Opportunity created** → link + initial stage.
2. **Opportunity stage changed** → update `pipeline_stage`.
3. **Opportunity status changed** (won/lost/abandoned) → terminal handling
   (§7).

Optional, add only if needed in practice:

4. **Contact updated** → backfill `customer_name` / `customer_phone` /
   `customer_address` when the AI heard them wrong.
5. **Appointment created** → belt-and-braces `booked` signal if booked jobs
   don't always pass through a stage change.

Nothing else. No notes, no tasks, no campaigns — the mirror needs stage
truth, not GHL's whole event firehose.

## 3. Delivery mechanism: GHL workflow webhooks → n8n (chosen)

**Chosen:** GHL Workflow → *Custom Webhook* action POSTing to an **n8n cloud
workflow** (`integrations/n8n/ghl-stage-sync.json`), which validates,
normalizes, and upserts into Supabase.

Why n8n instead of a bespoke endpoint:

- The business already runs its call automation in n8n cloud — same tool,
  same credentials, and every execution is visible/replayable in the n8n UI.
- No OAuth app, no marketplace review, no new infrastructure to deploy.
- Each sub-account's GHL workflow POSTs a hand-mapped body, so **we control
  the payload shape exactly** (§6). A shared secret travels as a static
  header (`X-Mirror-Key`), one per environment.

**Later (only if sub-account count grows painful):** a GHL marketplace app
with event subscriptions (`OpportunityCreate`, `OpportunityStageChange`,
`OpportunityStatusChange`) replaces per-account workflows with one install.
Don't build this until ~10+ sub-accounts; it's ceremony before then. A
Supabase Edge Function (`ghl-ingest`) remains the fallback if n8n ever
becomes the bottleneck — the design below is transport-agnostic.

*Verify against the live account:* exact trigger names and available merge
fields in the workflow builder; whether opportunity payloads carry contact
phone/address inline or only `contact_id` (if only the ID, the workflow must
include the contact fields as merge values, or the endpoint does one
contact-fetch API call — prefer merge fields, fewer moving parts).

## 4. The endpoint

One n8n workflow (`integrations/n8n/ghl-stage-sync.json`): a Webhook trigger
plus a single audited Code node that performs, in order:

```
POST https://<n8n-host>/webhook/ghl-stage-sync
Headers: X-Mirror-Key: <shared secret>
Body: JSON, shape defined by us in the GHL workflow (§6)
```

1. Reject missing/invalid `X-Mirror-Key`. The key lives only in the n8n
   workflow and the GHL action — never in the repo, never in the browser app
   (RLS grants end users no INSERT; all writes use the **service role** key,
   held server-side in n8n).
2. Normalize the payload and compute a unique event key.
3. Insert the raw payload into `ghl_events` (inbox, §5) with
   `on_conflict=event_key` merge — duplicate deliveries collapse.
   **This is the idempotency gate.**
4. Look up the stage in `ghl_stage_map`; unmapped stages are skipped and
   logged (with an alert-worthy execution record in n8n), never guessed.
5. Ordering guard: apply only if the event's source timestamp is newer than
   the row's `ghl_synced_at`; stale deliveries become no-ops.
6. Upsert `plumbing_leads` per §6 — update stage only, or insert a stub row
   if GHL knows an opportunity the voice stack never produced.

The webhook responds 200 on receipt (n8n `responseMode: onReceived`), so GHL
never retries into our face; failures are n8n executions we can inspect and
re-run — the inbox plus n8n's execution log *is* the reliability layer, with
the reconciliation backstop in §8.

## 5. Schema additions

Implemented as `supabase/migrations/0002_ghl_sync.sql` (idempotent; run it
once in the SQL editor — see `integrations/n8n/README.md` step 1). For the
record, the shape:

```sql
-- Inbox: every webhook delivery, exactly once.
create table public.ghl_events (
  id            bigint generated always as identity primary key,
  event_key     text not null unique,   -- see below
  location_id   text not null,
  event_type    text not null,          -- 'opportunity.created' | 'opportunity.stage_changed' | ...
  payload       jsonb not null,
  status        text not null default 'received',  -- received | processed | failed | skipped
  error         text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);
-- RLS: no end-user access at all (service role only). No policies = denied.

-- Stage mapping: GHL stage IDs are per-pipeline, per-account, and renamable.
create table public.ghl_stage_map (
  sub_account_id  uuid not null references public.crm_sub_accounts(sub_account_id),
  ghl_pipeline_id text not null,
  ghl_stage_id    text not null,
  pipeline_stage  text not null check (pipeline_stage in ('incoming','active','booked')),
  primary key (ghl_pipeline_id, ghl_stage_id)
);

-- Link key. Full unique index (no WHERE): PostgREST upserts can't match
-- partial indexes; multiple NULLs are allowed regardless.
create unique index plumbing_leads_ghl_opportunity_id_key
  on public.plumbing_leads (ghl_opportunity_id);
```

`event_key`: `location_id : event_type : ghl_opportunity_id :
stage_or_status : source_timestamp`. Duplicate deliveries of the same change
collapse onto the unique constraint. (If GHL's workflow builder can emit a
unique delivery ID, prefer that; verify in the live account.)

Note: `types.ts` does **not** change. These tables are server-side; the UI
contract stays exactly as it is.

## 6. Payload mapping → the Lead contract

The workflow webhook is configured to send (GHL merge-field names to be
confirmed in the live account — treat the left column as the contract we
configure, not gospel):

| Webhook field | `plumbing_leads` column | Rule |
|---|---|---|
| `locationId` | `sub_account_id` | via `crm_sub_accounts` lookup |
| `opportunity.id` | `ghl_opportunity_id` | upsert key |
| `opportunity.stage_id` (+ `pipeline_id`) | `pipeline_stage` | via `ghl_stage_map`; unmapped stage → keep current value, mark inbox `skipped`, alert us to map it |
| `contact.first_name + last_name` | `customer_name` | only if row has no name yet, or event is `contact.updated` |
| `contact.phone` | `customer_phone` | same guard |
| `contact.address1 + city + state + postal_code` | `customer_address` | same guard, joined `", "` |
| `opportunity.date_created` | — | never overwrite `created_at`; the call happened when it happened |

**Upsert rule (per event, after the inbox gate):**

- `opportunity.created`: if a row with this `ghl_opportunity_id` exists →
  update stage only. Else look for an unlinked row in the same sub-account
  with the same normalized phone created within the last 7 days → link it
  (set `ghl_opportunity_id`, set stage). Else create a new row
  (`pipeline_stage` from map, call columns null).
- `opportunity.stage_changed`: update `pipeline_stage` where
  `ghl_opportunity_id` matches. **Ordering guard:** apply only if the
  event's source timestamp is newer than the row's last GHL-applied change
  (store it on the row, e.g. `ghl_synced_at` — server-side column, not in
  `types.ts`). Out-of-order deliveries degrade to no-ops instead of
  regressing the stage.
- If no row matches a stage event: create a stub row (contact fields from
  payload) rather than dropping it — a lead with no call data is still true;
  the UI already handles null transcript.

**Phone matching is a linking heuristic, not an identity.** Normalize to
digits-only, last 10. Used only to attach `ghl_opportunity_id` to an
existing call-created row, only within 7 days, only when exactly one
candidate exists. Ambiguous → create a new row; a duplicate for a human to
merge beats a wrong link.

## 7. Terminal statuses

**Enum update (2026-09-10):** `pipeline_stage` is no longer the mirror
triple. Per the ARCHITECTURE.md pivot (2026-09-05) the CRM owns the stage
and the enum is the five CRM stages — `'new_lead' | 'contacted' |
'qualified' | 'proposal_sent' | 'closed_won'`. `ghl_stage_map` targets these
values (see `supabase/seeds/` for the live mapping); old rows were migrated
by `0004` (incoming → new_lead, active → contacted, booked → closed_won).

`won` → `pipeline_stage = 'closed_won'` (safety net; normally a stage change
already did it). `lost` / `abandoned` → out of scope for v1: keep showing
the last stage (the enum has no lost state and the UI contract doesn't
change). If "where did lost leads go" becomes a real question, that's a
product decision — another stage or a filter — not something to smuggle
into the sync.

## 8. Backstop: nightly reconciliation

Webhooks get missed. Once nightly (an n8n scheduled workflow, same pattern
as the sync), per active sub-account: pull open opportunities from the GHL
API, compare `ghl_opportunity_id` + stage against `plumbing_leads`, and emit
corrective events into the same inbox path (not direct writes — one code
path for all mutations). This makes the system self-healing within 24h and
turns "did the webhook fire?" into a non-incident.

Rate: a handful of locations × one paged API call — trivial against GHL
limits. Requires one GHL API key (private integration token) with
opportunities read scope, stored as an edge-function secret.

## 9. Non-goals (write them down or they'll creep in)

- **No write-back to GHL.** Ever, in this design. The CRM is a mirror.
- **No automation engine.** Outbound actions (SMS, emails, follow-ups) are
  n8n's job, fed by Supabase database webhooks — separate design.
- **No workflow builder UI.** The GHL-side config is three workflows per
  sub-account, set up by hand, documented per client.
- **No realtime push to the browser.** The plumber refreshes at 7am; stage
  truth that's seconds old is fine. (Supabase Realtime on `plumbing_leads`
  is a later nicety, one line of client code, deliberately not now.)

## 10. Rollout

1. Apply the §5 migration; deploy `ghl-ingest` with the secret.
2. Wire **one test sub-account**: three workflows, stage map rows filled in.
3. Move opportunities through stages in GHL; verify inbox rows and stage
   updates in the CRM. Test duplicates (refire a webhook) and out-of-order
   delivery.
4. Backfill: one API pull per sub-account through the reconciliation path.
5. Template the workflow setup as a per-client onboarding checklist.
6. Only then point real client sub-accounts at it.

## Open questions to verify in the live GHL account

- Exact workflow trigger names and merge-field paths for opportunity and
  contact data (§3, §6).
- Do opportunity webhooks carry contact phone/address inline, or is a
  contact fetch required?
- Can a workflow emit a unique delivery/execution ID for `event_key`?
- Stage IDs per pipeline per sub-account (fill `ghl_stage_map`).
- Does their plan allow agency-level workflows, or is it per-sub-account
  setup each time?
