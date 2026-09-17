# Booking — the table IS the calendar

Replaces GoHighLevel's calendar role (docs/ARCHITECTURE.md, 2026-09-05
pivot). Ericka books callers into fixed daily windows; `booking_slots`
tracks capacity, `appointments` tracks who. Schema + RPCs live in
`supabase/migrations/0005_booking_slots.sql`.

## The model

Three windows per day, per sub-account: `morning` (cap 3), `midday`
(cap 2), `late_afternoon` (cap 3). One row per
`(sub_account_id, slot_date, window)` with `booked_count` against
`capacity`. One timezone — America/Phoenix, no DST — so `slot_date` is a
plain `date`, anchored to Phoenix inside the RPCs. No times on purpose:
the plumber thinks in "tomorrow morning", not in 10:15 slots.

`appointments` hangs off a slot (`ON DELETE CASCADE`) and optionally links
a `plumbing_leads` row (`ON DELETE SET NULL`). Status is `booked` by
default; `cancelled` / `completed` / `no_show` cover the lifecycle.

## Call flow: ElevenLabs → n8n → RPC

Mid-call, Ericka needs to offer real openings and then book one:

1. **Check** — ElevenLabs tool-call hits the n8n `booking-tools` webhook
   with `action=check`. n8n queries `booking_slots` where
   `booked_count < capacity` and returns the open windows. Ericka only
   offers what comes back — if it's not in the response, it doesn't exist.
2. **Book** — once the caller picks, a second tool-call with
   `action=book` calls `public.book_slot(...)`. The RPC does
   `UPDATE ... SET booked_count = booked_count + 1 WHERE ... AND
   booked_count < capacity` in one statement, so two simultaneous calls
   can't oversell the last spot. It returns the new `appointment_id`, or
   NULL when the window filled (or was never provisioned) — on NULL the
   workflow reports back and Ericka offers the next option.
3. **Cancel** — `action=cancel` calls `public.release_slot(appointment_id)`:
   marks the appointment `cancelled` and decrements the count, atomically.
   Repeat calls are no-ops (only `booked` rows can be released).

The RPCs are `SECURITY DEFINER` with EXECUTE granted to `service_role`
only — they run inside n8n, never from the browser. Tenant users read
slots and appointments through plain table RLS.

## The nightly job (required)

Slots don't appear by themselves. The `booking-nightly-ensure-slots`
n8n workflow calls `public.ensure_slots(sub_account_id, 21)` for every
tenant each night, keeping a rolling 21-day horizon of window rows
(`ON CONFLICT DO NOTHING` — re-runs are free). If this job stops, booking
quietly starts returning "full or missing" once the horizon runs out —
alert on its failures.

## New tenant onboarding

After inserting the `crm_sub_accounts` row, either wait one night or run
once by hand in the SQL editor:

```sql
select public.ensure_slots('<sub_account_id>'::uuid, 21);
```

Non-default capacities are a one-line UPDATE on `booking_slots` (or set
them before the first `ensure_slots` run — conflicts keep existing rows).

## The UI

`/crm/<sub_account_id>/bookings` — who's booked today (name, phone,
window, linked-lead emergency badge) plus the next 7 days as
booked/capacity meters per window. Read-only; the AI books, the plumber
watches.
