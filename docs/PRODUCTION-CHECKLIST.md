# Ericka CRM — Production Greenlight Checklist

Verify every box before cold outreach. Items already marked were verified live on Sep 17, 2026 — the rest need you, and say exactly how.

---

## SECTION 1 — Live call behavior (one test call checks all four)
- [ ] Ericka answers within 2 rings and says the recording disclosure
- [ ] She asks for the caller's name early and captures it (data collection field)
- [ ] Mid-call availability check returns real windows — no dead air (pre-tool speech ON, tool timeout 8s)
- [ ] On "yes, book it," she confirms date + window + address back correctly before hanging up

_Settings done per your confirmation Sep 17 — the test call is the proof._

## SECTION 2 — Booking backend (verified today)
- [x] Slot window rolling: horizon Oct 8 (today + 21 days), 81 open slots in Supabase
- [x] check → book → cancel round-trip passes through the live webhook
- [x] `book_slot` is atomic — two simultaneous callers can't double-book a full window
- [x] Nightly `ensure_slots` cron ACTIVE (03:17 Phoenix) — window self-renews
- [x] Old mirror key dead (`{"error":"unauthorized"}`), new key returns 200 — rotated today
- [x] Appointments auto-link to their lead: `book_slot` falls back to phone-match (digits-normalized) when no lead_id passed — proven on the live test call, both existing appointments backfilled

## SECTION 3 — CRM production (deployed today)
- [x] erica-crm-rose.vercel.app serves the 7-tab build: Dashboard, Pipeline, Bookings, Contacts, Companies, Call Logs, Analytics
- [ ] Log in and open each of the 7 tabs once — confirm real data renders
- [ ] Pipeline lead cards click through to the lead detail page
- [ ] Bookings tab shows the appointment from your live test call
- [ ] No "GoHighLevel mirror" language anywhere — Supabase is the system of record

## SECTION 4 — Lead flow (call → CRM)
- [x] Call Feed workflow ACTIVE — calls land as leads with real name + phone (proven live: Ricky Sandoval, Kevin Garnett)
- [x] Name/phone mapping fixed and proven on a live call
- [ ] After your Section 1 test call: lead appears in Pipeline "Incoming" within 1 minute

## SECTION 5 — Alerts & self-healing
- [x] Error-alerts workflow ACTIVE — any workflow failure sends SMS to your cell (you received the test ones)
- [x] Watchdog ACTIVE (daily 04:40 Phoenix) — texts you if the booking window stops advancing
- [x] One-day grace by design: silence means at most one night failed

## SECTION 6 — Security (probed live, not assumed)
- [x] Mirror key re-rotated Sep 17 (2nd rotation) — the screenshot-exposed key is dead everywhere (`{"error":"unauthorized"}`); current key verified 200 with live slots
- [x] Service-role JWT lives in the encrypted n8n credential — no workflow JSON contains it
- [x] Stranger-with-anon-key probe: leads, contacts, companies + call-log source all return zero rows; booking tables return permission denied (anon has no table grants at all)
- [x] Stranger RPC probe: `book_slot`/`release_slot` invisible to anon (not exposed in the API schema), `cancel_appointment` = 42501 permission denied
- [x] EXECUTE grants read straight from the DB: `book_slot`/`release_slot` = service_role only; `cancel_appointment` = authenticated + service_role
- [x] All three booking functions SECURITY DEFINER with pinned `search_path` (public, pg_temp)
- [x] Every policy is tenant-scoped via sub_account_users membership (ready for client #2); admin claim sits in app_metadata — users can't self-promote
- [x] CRM write model verified: clients edit their own leads/contacts/companies through their session + RLS; booking capacity moves only via n8n service role or the tenant-checked cancel_appointment RPC

## SECTION 7 — Your moves before outreach
- [ ] Paste the new mirror key into your 3 ElevenLabs spots and SAVE (it's on your clipboard right now — paste it, don't screenshot it). Say "done" and I'll shred the /tmp backup
- [ ] Make the Section 1 test call — the final end-to-end proof (only works after the ElevenLabs paste)
- [ ] Cancel BOTH test appointments in the CRM (the Sep 17 one + the new one) → confirm total_booked returns to 0
- [ ] Say "commit" and I'll commit the repo — 23 files, full-content secret sweep already CLEAN (zero JWT/64-hex hits; .env* gitignored). Prod currently runs from uncommitted work
- [ ] Client-facing domain: erica-crm-rose.vercel.app is fine internally, but register a properly-spelled ericka domain before clients log in anywhere
- [ ] Client agreement: recording-consent clause — 30 minutes with a lawyer (AZ is one-party-consent, but callers can be anywhere)
- [ ] Onboarding checklist updated for the post-GHL stack (Steps 2/5/5b still say GHL — I'll rewrite them when you sign client #1)
- [ ] **Green light: start cold outreach.**
