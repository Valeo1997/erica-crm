# Move ericka-ai.com DNS off Vercel (Cloudflare, free)

## Why

Every ericka-ai.com host (the main site, plumbers, app, n8n) already runs on
the Hetzner box. Vercel only hosts the **DNS zone**. Vercel's billing keeps
failing and it has warned of shutdown; if the account shuts down, the DNS
goes with it, and with it the sites, the CRM, the n8n webhooks Ericka books
through, and the Zoho email on the domain.

Moving DNS doesn't move or change any site. Same records, new host.

## Before you start

- Check where the domain is **registered** (who you pay the yearly renewal
  to). If that's Vercel too, transfer the registration to Cloudflare after
  the DNS move (Cloudflare Registrar sells at cost). If it's somewhere else,
  you only change nameservers there.
- The full record list is the zone file in the ericaforplumbers repo:
  `Desktop/Ericka/ericka-deploy/dns/ericka-ai.com.zone`. It was checked
  against live DNS on Nov 20 and leaves out the two Vercel ALIAS records on
  purpose.

## Steps (about 20 minutes, plus propagation)

1. Cloudflare dashboard → **Add a domain** → `ericka-ai.com` → Free plan.
2. When it scans records, delete what it found and use **Import DNS
   records** with that zone file instead, so you get exactly the known-good
   set.
3. Set every A record (`@`, `www`, `plumbers`, `app`, `n8n`) to **DNS only**
   (grey cloud) for now. Caddy on Hetzner gets its own Let's Encrypt
   certificates; proxying can be turned on later once you're sure HTTPS
   works through Cloudflare.
4. Check the MX, SPF, DKIM (`zmail._domainkey`) and DMARC records are there,
   or Zoho mail stops.
5. Cloudflare shows two nameservers. At the registrar, replace the Vercel
   nameservers with those two.
6. Wait until Cloudflare says the domain is **Active** (minutes to a few
   hours). Then open ericka-ai.com, plumbers.ericka-ai.com and
   app.ericka-ai.com, send yourself an email to val@, and make one test call
   to Ericka to confirm a booking lands.
7. Only after all of that works: remove the domain from Vercel and close or
   settle the Vercel account. Also disconnect the erica-crm repo from Vercel
   so it stops attempting builds.
