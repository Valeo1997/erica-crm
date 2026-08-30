# Auth & Tenant Isolation — Design

## Context

Ericka CRM is a multi-tenant plumbing-lead CRM. Each client business is a row
in `crm_sub_accounts` (`sub_account_id`), and its leads live in
`plumbing_leads` keyed by `sub_account_id`. The app is being sold to multiple
plumbing businesses.

Today there is no authentication anywhere in the app. All pages are client
components that query Supabase directly with the public anon key
(`src/lib/supabase.ts`). Anyone who knows or guesses a `sub_account_id` can
view that business's leads at `/crm/[sub_account_id]/pipeline`, and — once
RLS is confirmed open, which it currently must be for the app to work at all
— any anon key holder can query **every** business's leads directly against
the Supabase REST API, bypassing the UI entirely. This is a real
cross-tenant data leak once more than one paying customer has data in the
system, and it needs to close before this is sold to more than one client.

## Goals

- Plumbing-business users log in and can only ever see their own
  `sub_account_id`'s data — enforced at the database layer (RLS), not just
  hidden in the UI.
- You/your team can log in as admins and see across all accounts (the
  `crm/layout.tsx` file already has a "client-selector dropdown placeholder"
  comment anticipating this).
- No public sign-up. You create accounts manually.
- Minimal new schema — reuse the existing `sub_account_users` and
  `crm_sub_accounts` tables.

## Non-goals

- Self-serve sign-up / billing.
- Password reset UI polish beyond Supabase's default flow.
- An admin UI for creating accounts (creation stays a manual/dashboard step
  for now).
- Building the "client-selector dropdown" UI itself — out of scope for this
  spec, just noting the auth model needs to support it later.

## Existing schema (confirmed via Supabase Studio, unchanged by this spec)

```
crm_sub_accounts
  sub_account_id      uuid   PK
  company_name        text
  elevenlabs_voice_id text

sub_account_users
  user_id             uuid   (FK -> auth.users.id)
  sub_account_id      uuid   (FK -> crm_sub_accounts.sub_account_id)

plumbing_leads
  lead_id             uuid   PK
  sub_account_id      uuid
  ghl_opportunity_id  text | null
  customer_name       text
  customer_phone      text
  customer_address    text
  plumbing_issue      text
  emergency_level     text
  pipeline_stage      enum ('incoming' | 'active' | 'booked')
  transcript          text | null
  call_id             text
  created_at          timestamptz
```

Both `crm_sub_accounts` and `plumbing_leads` currently show "1 RLS policy" in
Studio — as part of implementation we need to inspect and replace that
policy with the tenant-isolation policy below; it's very likely a
permissive `USING (true)` policy today, since the app works with only the
anon key.

## Admin representation

No role column exists. Rather than adding one (which risks RLS recursion
problems if it lived in a table users could theoretically influence),
admin status is stored in the Supabase Auth user's `app_metadata`:

```json
{ "is_admin": true }
```

`app_metadata` can only be set by a service-role call (dashboard or a
script using the service key) — never by the user themselves — so it's
safe to trust inside RLS policies via `auth.jwt() -> 'app_metadata' ->>
'is_admin'`.

## Architecture

### 1. Supabase clients

Two thin wrappers replace the single `src/lib/supabase.ts`:

- `src/lib/supabase/client.ts` — browser client (`createBrowserClient` from
  `@supabase/ssr`), used by existing client components (pipeline,
  call-logs).
- `src/lib/supabase/server.ts` — server client (`createServerClient`) for
  Server Components / Route Handlers (used by `/login` and any future
  server-rendered pages), reading/writing cookies via `next/headers`.

Both use the **existing** env var names already deployed to Vercel:
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. (Not the
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` name from Supabase's generic
boilerplate — that would just create a second, unused env var.)

`src/lib/supabase.ts` is deleted; its one import site
(`src/app/crm/[sub_account_id]/pipeline/page.tsx`, and presumably
call-logs) is updated to import the new browser client.

### 2. Middleware

Root-level `middleware.ts` using `createServerClient` (per `@supabase/ssr`
conventions) to:

- Refresh the auth session cookie on every request.
- Redirect unauthenticated requests to `/crm/*` → `/login`.
- Leave `/login` and static assets untouched.

Matcher config excludes `_next/static`, `_next/image`, and common static
file extensions, per Supabase's standard middleware pattern.

### 3. Login page

`src/app/login/page.tsx` — a client component with an email + password
form calling `supabase.auth.signInWithPassword({ email, password })`. On
success, redirect to `/crm/[their sub_account_id]/pipeline` (looked up via
a `sub_account_users` query) for non-admins, or to a neutral landing
page for admins (out of scope to build the account picker itself — for now
admins can be redirected to `/crm/[first sub_account_id]/pipeline` or a
simple "choose an account" text list).

A sign-out action (button in `crm/layout.tsx`'s `<aside>`) calls
`supabase.auth.signOut()` and redirects to `/login`.

### 4. Row Level Security (migration)

New SQL migration replacing the existing permissive policies:

```sql
-- plumbing_leads
drop policy if exists <existing_policy_name> on plumbing_leads;

create policy "tenant isolation" on plumbing_leads
for select using (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean is true
  or exists (
    select 1 from sub_account_users su
    where su.sub_account_id = plumbing_leads.sub_account_id
      and su.user_id = auth.uid()
  )
);

-- crm_sub_accounts: same pattern, scoped to sub_account_id = crm_sub_accounts.sub_account_id
```

`sub_account_users` itself gets a policy so a user can read only their own
membership row(s) (`user_id = auth.uid()`), which the `exists (...)`
subquery above relies on implicitly via `security definer`-free RLS (the
subquery runs as the querying user, which is fine since they're only
checking their own `user_id`).

Write policies (INSERT/UPDATE on `plumbing_leads` for drag-and-drop stage
changes) get the same `exists (...)` check, admin-or-own-tenant.

### 5. Page changes

- `pipeline/page.tsx` and `call-logs/page.tsx`: import path changes only
  (`@/lib/supabase/client` instead of `@/lib/supabase`). RLS does the
  enforcement — if a logged-in user hits another tenant's
  `sub_account_id` URL, the query now returns zero rows instead of that
  tenant's real data.
- `crm/layout.tsx`: add a sign-out button; the "client-selector dropdown"
  placeholder stays a placeholder (future work).

## Error handling

- Wrong password / unknown email: Supabase returns an error object;
  display inline on the login form.
- Logged-in user with no `sub_account_users` row and no `is_admin`: treated
  as zero-access — pipeline/call-logs pages already render "No leads yet"
  correctly for zero rows, so this fails safe without extra code, though
  we should show a clearer "no account access" message rather than
  reusing the empty-state copy.
- Middleware session refresh failure: falls through to treating the user
  as unauthenticated (redirect to `/login`), per Supabase's documented
  pattern.

## Testing

- Manual: create two test users via Supabase dashboard, each linked to a
  different `sub_account_id` in `sub_account_users`; confirm each only
  sees their own leads, and that a direct URL edit to the other tenant's
  `sub_account_id` returns an empty pipeline, not their data.
- Manual: create one admin user (`app_metadata.is_admin = true`, no
  `sub_account_users` row); confirm they can see all tenants' leads.
- Manual: confirm unauthenticated request to `/crm/anything/pipeline`
  redirects to `/login`.

## Dependencies

- New package: `@supabase/ssr`.
