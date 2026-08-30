# Auth & Tenant Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Auth (email/password) to Ericka CRM so plumbing-business users can only ever see their own `sub_account_id`'s data, enforced at the database layer, with an admin override for internal staff.

**Architecture:** Replace the single unauthenticated Supabase client with `@supabase/ssr` browser/middleware clients. Root `middleware.ts` refreshes the session cookie and redirects unauthenticated `/crm/*` requests to `/login`. A new `/login` page signs in and routes the user to their account (or an admin account-picker). Row Level Security policies on `plumbing_leads`, `crm_sub_accounts`, and `sub_account_users` do the actual tenant-isolation enforcement — the app-layer routing is a UX convenience, not the security boundary.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (`@supabase/supabase-js` already present, adding `@supabase/ssr`), TypeScript, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-30-auth-and-tenant-isolation-design.md`

## Global Constraints

- Use the existing env var names already deployed to Vercel:
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do not
  introduce `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or any other name.
- Only new dependency: `@supabase/ssr`.
- Admin status lives in the Supabase Auth user's `app_metadata.is_admin`
  (boolean) — never a database column, never user-editable.
- No public sign-up page or flow.
- This repo has no test framework and none should be introduced as part
  of this plan. Verification per task is `npx tsc --noEmit`, `npm run
  build`, `npm run lint`, and the manual browser/SQL steps called out in
  each task — matching the spec's own "Testing" section (manual
  verification against real Supabase Auth users).

---

## File Map

| File | Change |
|---|---|
| `package.json` | add `@supabase/ssr` |
| `src/lib/supabase.ts` | **delete** |
| `src/lib/supabase/client.ts` | **new** — browser Supabase client singleton |
| `src/app/crm/[sub_account_id]/pipeline/page.tsx` | modify import path |
| `src/app/crm/[sub_account_id]/call-logs/page.tsx` | modify import path |
| `src/lib/supabase/middleware.ts` | **new** — session refresh + redirect logic |
| `src/proxy.ts` | **new** — Next.js 16 proxy entrypoint (renamed from `middleware.ts`; must live next to `src/app`, not the repo root) |
| `src/app/login/page.tsx` | **new** — email/password login form |
| `src/app/crm/page.tsx` | **new** — admin "choose an account" list |
| `src/app/crm/SignOutButton.tsx` | **new** — client component sign-out button |
| `src/app/crm/layout.tsx` | modify — render `SignOutButton` |
| `supabase/migrations/0001_tenant_isolation_rls.sql` | **new** — RLS policies (run manually in Supabase SQL Editor) |

---

### Task 1: Supabase browser client + migrate existing pages

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase/client.ts`
- Delete: `src/lib/supabase.ts`
- Modify: `src/app/crm/[sub_account_id]/pipeline/page.tsx:4`
- Modify: `src/app/crm/[sub_account_id]/call-logs/page.tsx:4`

**Interfaces:**
- Produces: `supabase` — a ready-to-use `SupabaseClient` instance, exported
  from `src/lib/supabase/client.ts`, used identically to the old
  `src/lib/supabase.ts` export (`supabase.from(...)`, etc.). Later tasks
  (login page, sign-out button, admin picker) import this same singleton.

- [ ] **Step 1: Install `@supabase/ssr`**

Run: `npm install @supabase/ssr`

- [ ] **Step 2: Create the browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

This stores the session in cookies (not `localStorage`), which is what
lets the middleware (Task 2) read the same session on the server side.

- [ ] **Step 3: Delete the old client**

Run: `rm src/lib/supabase.ts`

- [ ] **Step 4: Update the pipeline page's import**

In `src/app/crm/[sub_account_id]/pipeline/page.tsx`, change line 4 from:

```ts
import { supabase } from '@/lib/supabase';
```

to:

```ts
import { supabase } from '@/lib/supabase/client';
```

- [ ] **Step 5: Update the call-logs page's import**

In `src/app/crm/[sub_account_id]/call-logs/page.tsx`, change line 4 from:

```ts
import { supabase } from '@/lib/supabase';
```

to:

```ts
import { supabase } from '@/lib/supabase/client';
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no other file still imports the deleted
`@/lib/supabase`).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts src/lib/supabase/client.ts src/app/crm/\[sub_account_id\]/pipeline/page.tsx src/app/crm/\[sub_account_id\]/call-logs/page.tsx
git commit -m "Replace supabase-js client with @supabase/ssr browser client"
```

---

### Task 2: Session-refresh middleware with route protection

**Files:**
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`,
  `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (same env vars as Task 1).
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>`,
  exported from `src/lib/supabase/middleware.ts`. Called by
  `src/proxy.ts`; no other task depends on this function directly.

- [ ] **Step 1: Create the session-refresh + redirect helper**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/crm');

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Create the proxy entrypoint**

Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
(same behavior, new name — see
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
It must live next to `src/app` (i.e. inside `src/`), not the repo root,
since this project uses a `src/` directory.

Create `src/proxy.ts`:

```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (Next.js will report the middleware in the
build output).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then in a browser visit
`http://localhost:3000/crm/test-account/pipeline` while logged out (no
Supabase session cookie).
Expected: redirected to `http://localhost:3000/login` (the page will
404 until Task 3, but the URL bar should show `/login` — confirming the
redirect fired).

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/lib/supabase/middleware.ts
git commit -m "Add session-refresh middleware with /crm route protection"
```

---

### Task 3: Login page

**Files:**
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase/client.ts` (Task 1).
- Produces: nothing consumed by other tasks — this is a leaf page.

- [ ] **Step 1: Create the login page**

Create `src/app/login/page.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      setError(signInError?.message ?? 'Login failed.');
      setIsSubmitting(false);
      return;
    }

    const isAdmin = signInData.user.app_metadata?.is_admin === true;

    if (isAdmin) {
      router.push('/crm');
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from('sub_account_users')
      .select('sub_account_id')
      .eq('user_id', signInData.user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      setError('Your account has no assigned business. Contact support.');
      setIsSubmitting(false);
      return;
    }

    router.push(`/crm/${membership.sub_account_id}/pipeline`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Log in
        </h1>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, `/login` listed as a static/dynamic route in
the output.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "Add email/password login page"
```

---

### Task 4: Admin account picker

**Files:**
- Create: `src/app/crm/page.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase/client.ts` (Task 1).
- Produces: nothing consumed by other tasks — this is a leaf page. This
  is the destination the login page (Task 3) sends admins to.

**Why this exists:** the spec's non-goal explicitly excludes building the
polished "client-selector dropdown" UI, but redirecting an admin to a page
that doesn't exist (`/crm`) would 404. This is the minimal real page that
satisfies that redirect: a plain list of every account, linking into its
pipeline. RLS (Task 6) is what actually lets an admin see every row here;
a non-admin hitting this page will just see their own single account (or
none).

- [ ] **Step 1: Create the account list page**

Create `src/app/crm/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface SubAccount {
  sub_account_id: string;
  company_name: string;
}

export default function CrmAccountPickerPage() {
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('crm_sub_accounts')
      .select('sub_account_id, company_name')
      .order('company_name', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Failed to load accounts:', error.message);
          setAccounts([]);
        } else {
          setAccounts((data ?? []) as SubAccount[]);
        }
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Choose an account
        </h1>

        {isLoading && (
          <p className="text-sm text-neutral-400">Loading accounts…</p>
        )}

        {!isLoading && accounts.length === 0 && (
          <p className="text-sm text-neutral-400">No accounts found.</p>
        )}

        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={account.sub_account_id}>
              <Link
                href={`/crm/${account.sub_account_id}/pipeline`}
                className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                {account.company_name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, `/crm` listed as a route.

- [ ] **Step 3: Commit**

```bash
git add src/app/crm/page.tsx
git commit -m "Add admin account picker page at /crm"
```

---

### Task 5: Sign-out button

**Files:**
- Create: `src/app/crm/SignOutButton.tsx`
- Modify: `src/app/crm/layout.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase/client.ts` (Task 1).
- Produces: `SignOutButton` component, default export from
  `src/app/crm/SignOutButton.tsx`, consumed only by
  `src/app/crm/layout.tsx` in this task.

- [ ] **Step 1: Create the sign-out button component**

Create `src/app/crm/SignOutButton.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 2: Wire it into the CRM layout**

Replace the full contents of `src/app/crm/layout.tsx`:

```tsx
import SignOutButton from './SignOutButton';

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <aside className="flex items-center justify-end gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        {/* client-selector dropdown placeholder */}
        <SignOutButton />
      </aside>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/crm/SignOutButton.tsx src/app/crm/layout.tsx
git commit -m "Add sign-out button to CRM layout"
```

---

### Task 6: RLS policies + manual verification

**Files:**
- Create: `supabase/migrations/0001_tenant_isolation_rls.sql`

**Interfaces:**
- None — this is a database change applied manually through the Supabase
  SQL Editor (no service-role key or Supabase CLI link is configured in
  this environment to run it programmatically). The file is committed
  for provenance and future `supabase db push` use if the project is
  ever CLI-linked.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_tenant_isolation_rls.sql`:

```sql
-- Drop whatever policies currently exist on these tables (their exact
-- names are unknown from the client — this discovers and drops them
-- generically instead of guessing).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plumbing_leads'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.plumbing_leads', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'crm_sub_accounts'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.crm_sub_accounts', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sub_account_users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sub_account_users', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.sub_account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plumbing_leads ENABLE ROW LEVEL SECURITY;

-- A user can see their own membership row(s). This is what the EXISTS
-- subqueries below rely on: RLS runs as the querying user, so this
-- subquery only ever "sees" that user's own rows.
CREATE POLICY "users read own membership" ON public.sub_account_users
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tenant isolation select" ON public.crm_sub_accounts
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = crm_sub_accounts.sub_account_id
      AND su.user_id = auth.uid()
  )
);

CREATE POLICY "tenant isolation select" ON public.plumbing_leads
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = plumbing_leads.sub_account_id
      AND su.user_id = auth.uid()
  )
);

-- Covers future writes (e.g. persisting pipeline drag-and-drop stage
-- changes); the app doesn't perform any UPDATE yet, but the surface
-- should be closed by default rather than left open.
CREATE POLICY "tenant isolation update" ON public.plumbing_leads
FOR UPDATE USING (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = plumbing_leads.sub_account_id
      AND su.user_id = auth.uid()
  )
) WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean IS TRUE
  OR EXISTS (
    SELECT 1 FROM public.sub_account_users su
    WHERE su.sub_account_id = plumbing_leads.sub_account_id
      AND su.user_id = auth.uid()
  )
);
```

- [ ] **Step 2: Run the migration in Supabase**

Open `https://supabase.com/dashboard/project/phtmarvmovozydxipmat/sql/new`,
paste the full contents of `0001_tenant_isolation_rls.sql`, and run it.
Expected: "Success. No rows returned."

- [ ] **Step 3: Create two test users and an admin user**

In `https://supabase.com/dashboard/project/phtmarvmovozydxipmat/auth/users`:

1. Click "Add user" → create `tenant-a@test.local` with a password.
   Note the generated user's UUID.
2. Click "Add user" → create `tenant-b@test.local` with a password.
   Note the generated user's UUID.
3. Click "Add user" → create `admin@test.local` with a password. After
   creating it, click into the user, find "Raw App Meta Data", and set
   it to `{"is_admin": true}`.

In the Table Editor
(`https://supabase.com/dashboard/project/phtmarvmovozydxipmat/editor`):

4. In `crm_sub_accounts`, insert two rows (if none exist yet) with
   distinct `sub_account_id` UUIDs and `company_name` values (e.g.
   "Acme Plumbing" and "Best Plumbing").
5. In `sub_account_users`, insert one row linking `tenant-a@test.local`'s
   UUID to the first `sub_account_id`, and one row linking
   `tenant-b@test.local`'s UUID to the second `sub_account_id`. Leave
   `admin@test.local` with no row here (admins don't need one).
6. In `plumbing_leads`, insert at least one row for each of the two
   `sub_account_id`s so there's visible data to distinguish.

- [ ] **Step 4: Manually verify tenant isolation**

Run: `npm run dev`

1. Go to `http://localhost:3000/login`, sign in as `tenant-a@test.local`.
   Expected: redirected to `/crm/<tenant-a's sub_account_id>/pipeline`,
   showing only tenant A's lead(s).
2. Manually edit the URL to `/crm/<tenant-b's sub_account_id>/pipeline`.
   Expected: page loads (no crash) but shows "No leads yet for this
   account" — RLS returns zero rows for the account tenant A doesn't
   belong to.
3. Click "Sign out". Expected: redirected to `/login`.
4. Sign in as `admin@test.local`. Expected: redirected to `/crm`,
   showing both "Acme Plumbing" and "Best Plumbing" in the list.
   Clicking either shows that account's real lead(s).
5. While signed out, visit `/crm/<any sub_account_id>/pipeline` directly.
   Expected: redirected to `/login` before the page renders.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_tenant_isolation_rls.sql
git commit -m "Add RLS policies enforcing tenant isolation"
```
