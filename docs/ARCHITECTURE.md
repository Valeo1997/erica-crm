# Product Architecture

Three pieces of infrastructure. Each does one job.

## 1. ericka-ai.com — Product identity
Represents Ericka as a product/brand. The identity layer. Not being replaced,
retired, or merged into anything.

## 2. ericaforplumber.com — Conversion engine
Built deliberately and separately to:
- Capture SEO for plumbing-industry search terms
- Drive higher-converting landing-page traffic than the identity site could alone

An intentional, purpose-built asset. **Do not fold it back into ericka-ai.com.**

## 3. This repo (ericka-crm) — The CRM, and the system of record

**Superseded 2026-09-05.** This document previously said the CRM was a temporary
GoHighLevel mirror, that GHL was authoritative, and that the pipeline UI was a
read-only status view. **That is no longer the direction.** The sections below
record what changed and why, so the old model doesn't get reinstated by accident.

### The decision

This CRM is being built into a **full GoHighLevel replacement** and the **system
of record** for Ericka's customer data. It is a **multi-tenant SaaS product**:
the agency on top, client sub-accounts beneath, and **clients log into their own
sub-account** rather than Valentin switching on their behalf.

### What the previous model traded away

The mirror existed for a concrete reason worth keeping on the record: GHL's first
pricing tier caps at **3 sub-accounts**, and mirroring GHL's structure let that
tier be stretched without hitting the ceiling. Going full-replace gives up that
hedge and means rebuilding, in-house and over time:

- Twilio two-way SMS and the conversations inbox
- Calendars and client-facing booking
- Email sending and templates
- Forms
- The workflow automation builder (on the existing n8n engine)

This tradeoff was raised explicitly and the full-replace decision was reaffirmed.
**Don't relitigate it.**

### Scope discipline

Replacing *GoHighLevel the product* is not the goal. Replacing **the parts of GHL
that are actually used** is. Scope is derived from screenshots of the real
workflows, inbox, custom fields and pipelines in use — not from feature-matching
GHL's marketing page. When in doubt, ask what actually gets opened.

### What this means for the code

- The CRM **owns** its data. `pipeline_stage` is authoritative here; it is no
  longer synced in from GHL as the source of truth.
- `ghl_opportunity_id` degrades to a migration/backfill link, not a foreign
  authority. Keep it while data is being moved across; it is not a dependency.
- Tenant isolation is load-bearing and already implemented — see
  `supabase/migrations/0001_tenant_isolation_rls.sql`. Every new table holding
  customer data **must** carry `sub_account_id` and get equivalent RLS policies
  before it holds a single real row.
- The UI comes from the `New CRM` project (monochrome "Ericka's Desk" design
  system, five pipeline stages, plus Contacts and Companies pages). Porting it
  requires reconciling two data models: this repo currently has one
  `plumbing_leads` table with three stages (`incoming` / `active` / `booked`),
  and no contacts or companies tables at all.
- **Write paths (as of 2026-09-15):** app pages write client→Supabase under RLS
  (contacts, companies — full CRUD; `plumbing_leads` — update only). Booking
  tables (`appointments`, `booking_slots`) stay read-only for client logins —
  all availability writes flow through n8n's service role. The single exception
  is `public.cancel_appointment(uuid)`: a SECURITY DEFINER RPC granted to
  `authenticated` that verifies the caller's tenant membership (or admin claim)
  before delegating to the service-role-locked `release_slot`. Never ship the
  service key to the browser to work around this — add a tenant-checked RPC
  instead, following that function as the template.

Supersedes: Product_Architecture_Clarification, 2026-08-30.
