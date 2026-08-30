# Product Architecture

Three separate pieces of infrastructure. Not versions of each other, not
redundant, not stepping stones toward replacing one another. Each does one job.

## 1. ericka-ai.com — Product identity
Represents Ericka as a product/brand. The identity layer. Not being replaced,
retired, or merged into anything.

## 2. ericaforplumber.com — Conversion engine
Built deliberately and separately to:
- Capture SEO for plumbing-industry search terms
- Drive higher-converting landing-page traffic than the identity site could alone

An intentional, purpose-built asset. **Do not fold it back into ericka-ai.com.**

## 3. This repo (erica-crm) — Temporary GHL mirror
**This CRM is not Ericka AI, and it is not a GoHighLevel replacement — for now.**

It mirrors GHL and runs alongside it. GHL stays the system of record; the CRM
is a parallel mirroring layer.

Why it exists: GHL's first pricing tier caps accounts at 3 sub-accounts. A CRM
that mirrors GHL's structure lets that tier be maximized without hitting the
ceiling prematurely.

Long-term this CRM may replace GHL entirely — but only once Ericka AI has grown
and the skillset behind the CRM has matured. Until then, GHL is authoritative
and the CRM is a read/mirror surface.

### What this means for the code
- `sub_account_id` mirrors a GHL sub-account. `ghl_opportunity_id` links a lead
  row back to its GHL opportunity.
- `pipeline_stage` mirrors GHL pipeline stages. Stage changes originate in GHL
  and sync into Supabase — the CRM does not own that state. The pipeline UI is
  a status view, not a task board.
- Don't build features that assume the CRM is the source of truth.
- It's a temporary operational tool. Keep it clean and on-brand, but don't
  gold-plate it.

Source: Product_Architecture_Clarification, 2026-08-30.
