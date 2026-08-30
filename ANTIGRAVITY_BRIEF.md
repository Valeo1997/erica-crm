# Antigravity Brief — Ericka CRM UI Rebuild

## Your job
Rebuild the visual layer of this CRM. The backend, auth, and database security
are done and working — you are not touching them. Design decisions are yours.

## Hard boundaries — do NOT modify
- `src/lib/types.ts` — the `Lead` interface is a fixed contract. Match field
  names exactly. Do not add, rename, or remove fields.
- `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- `src/proxy.ts` — auth route protection
- `supabase/migrations/*` — RLS policies
- `package.json` deps: don't add a UI kit, component library, or animation
  library. Tailwind 4 is already here. Build the components.

## You own everything under `src/app/`
Rebuild freely: `crm/layout.tsx`, `crm/page.tsx`, `crm/[sub_account_id]/pipeline/page.tsx`,
`crm/[sub_account_id]/call-logs/page.tsx`, `login/page.tsx`, `page.tsx`, `globals.css`.

## Stack — read before writing code
Next.js **16.3.3**, React 19, Tailwind CSS 4, TypeScript.
This is not the Next.js in your training data. Middleware is `src/proxy.ts`, not
`middleware.ts`. Route params are a Promise (`use(params)` in client components).
Read `node_modules/next/dist/docs/` for anything you're unsure about.

## Brand — this is the point
The current UI is generic Tailwind admin dashboard: gray cards, sky/violet/emerald
dots, system sans, rounded-xl everywhere. It looks like every other plumbing SaaS.
Kill it.

Ericka's identity is **warm-dark, orange accent, Fraunces for display type** —
deliberately off the blue/sans template. Look at **ericka-ai.com** and carry that
identity into the app. Same warmth, same type, same confidence.

## What this actually is
A **temporary operational mirror of GoHighLevel** — not Ericka AI, not a GHL
replacement. GHL is the system of record; this CRM reflects it. Full context in
`docs/ARCHITECTURE.md` — read it.

For the plumber it's one thing: where they check what the AI receptionist did
overnight. Design for that moment — **7am, coffee, phone or laptop, 15 seconds.**
Who called? Who's an emergency? What's booked today? That's the hierarchy. Not
"three enum columns rendered as a Kanban."

It's a tool, not a brand showcase. Warm and on-brand per below, but don't
gold-plate it — it may be replaced later.

## The two screens

**Pipeline** — leads by stage. Stage values are exactly `'incoming' | 'active' | 'booked'`
(database enum, don't invent labels that imply other values). Currently drag-and-drop,
but drops don't persist — **GHL owns pipeline stage**, changes sync in from there.
Make this read-only and design it as a status view, not a task board. Don't build
affordances that lie about what the app can do.

**Call Logs** — every call the AI answered, newest first. Searchable. Each row expands
to a transcript. The transcript is the product — treat it as content worth reading,
not a table cell.

`emergency_level` is free text from the AI. Common values: `emergency`, `urgent`,
`routine`, and a `standard` default. Handle unknown values gracefully.

## Rules of engagement
- **Design decisions are yours.** Layout, motion, hierarchy, components, empty
  states, loading states. Don't ask permission. Don't ask which shade of orange.
- Mobile matters — plumbers are in a truck.
- Verify with `npm run build`. Do not start the dev server or read its logs.
- Work on a branch, not `main`.
- Summary max 5 lines. Don't explain the code back to me.
