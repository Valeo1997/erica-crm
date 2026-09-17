'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';
import { STAGE_DISPLAY, StatCard } from '@/app/crm/components/record-ui';

const EMERGENCY_STYLES: Record<string, string> = {
  emergency: 'bg-red-500/15 text-red-400 ring-red-500/40',
  urgent: 'bg-ember/15 text-ember ring-ember/40',
  routine: 'bg-soot text-fog ring-seam',
  standard: 'bg-soot text-fog ring-seam',
};
const EMERGENCY_FALLBACK = 'bg-soot text-fog ring-seam';

function EmergencyBadge({ level }: { level: Lead['emergency_level'] }) {
  const classes = EMERGENCY_STYLES[level.toLowerCase()] ?? EMERGENCY_FALLBACK;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${classes}`}
    >
      {level}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [companyCount, setCompanyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      supabase
        .from('plumbing_leads')
        .select('*')
        .eq('sub_account_id', sub_account_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('contacts')
        .select('contact_id', { count: 'exact', head: true })
        .eq('sub_account_id', sub_account_id),
      supabase
        .from('companies')
        .select('company_id', { count: 'exact', head: true })
        .eq('sub_account_id', sub_account_id),
    ]).then(([leadsRes, contactsRes, companiesRes]) => {
      if (!isMounted) return;
      if (leadsRes.error) {
        console.error('Failed to load leads:', leadsRes.error.message);
        setLeads([]);
      } else {
        setLeads((leadsRes.data ?? []) as Lead[]);
      }
      if (contactsRes.error) {
        console.error('Failed to count contacts:', contactsRes.error.message);
      } else {
        setContactCount(contactsRes.count ?? 0);
      }
      if (companiesRes.error) {
        console.error('Failed to count companies:', companiesRes.error.message);
      } else {
        setCompanyCount(companiesRes.count ?? 0);
      }
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [sub_account_id]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newToday = leads.filter(
      (l) => new Date(l.created_at).getTime() >= todayStart.getTime()
    ).length;
    const openEmergencies = leads.filter(
      (l) =>
        l.emergency_level.toLowerCase() === 'emergency' &&
        l.pipeline_stage !== 'closed_won'
    ).length;
    const closedWon = leads.filter((l) => l.pipeline_stage === 'closed_won').length;
    const conversion = leads.length > 0 ? Math.round((closedWon / leads.length) * 100) : 0;
    return { newToday, openEmergencies, closedWon, conversion };
  }, [leads]);

  const recentLeads = leads.slice(0, 6);
  const base = `/crm/${sub_account_id}`;

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-fog">
              What the AI receptionist did, at a glance.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading dashboard…
          </p>
        )}

        {!isLoading && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="New today"
                value={stats.newToday}
                hint="since midnight"
                href={`${base}/pipeline`}
              />
              <StatCard
                label="Open emergencies"
                value={stats.openEmergencies}
                hint="not yet closed"
                href={`${base}/pipeline`}
              />
              <StatCard
                label="Total leads"
                value={leads.length}
                hint={`${stats.closedWon} closed won`}
                href={`${base}/pipeline`}
              />
              <StatCard
                label="Conversion"
                value={`${stats.conversion}%`}
                hint="leads → closed won"
                href={`${base}/analytics`}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Pipeline overview */}
              <section className="rounded-xl border border-seam bg-coal lg:col-span-2">
                <div className="flex items-center justify-between border-b border-seam px-4 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                    Pipeline overview
                  </h2>
                  <Link
                    href={`${base}/pipeline`}
                    className="text-xs font-medium text-ember transition-colors hover:text-flare"
                  >
                    Open pipeline →
                  </Link>
                </div>
                {leads.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-fog">
                    No leads yet — they&apos;ll appear here as calls come in.
                  </p>
                ) : (
                  <div className="space-y-3 p-4">
                    {STAGE_DISPLAY.map((s) => {
                      const count = leads.filter(
                        (l) => l.pipeline_stage === s.stage
                      ).length;
                      const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                      return (
                        <Link
                          key={s.stage}
                          href={`${base}/pipeline`}
                          className="group flex items-center gap-3"
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                          <span className="w-28 shrink-0 text-sm text-fog transition-colors group-hover:text-cream">
                            {s.label}
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-soot">
                            <span
                              className={`block h-full rounded-full ${s.bar} transition-all`}
                              style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-cream">
                            {count}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Book of business */}
              <section className="rounded-xl border border-seam bg-coal">
                <div className="border-b border-seam px-4 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                    Book of business
                  </h2>
                </div>
                <div className="divide-y divide-seam">
                  <Link
                    href={`${base}/contacts`}
                    className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-soot"
                  >
                    <span className="text-sm text-fog">Contacts</span>
                    <span className="text-sm font-semibold tabular-nums text-cream">
                      {contactCount}
                    </span>
                  </Link>
                  <Link
                    href={`${base}/companies`}
                    className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-soot"
                  >
                    <span className="text-sm text-fog">Companies</span>
                    <span className="text-sm font-semibold tabular-nums text-cream">
                      {companyCount}
                    </span>
                  </Link>
                  <Link
                    href={`${base}/call-logs`}
                    className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-soot"
                  >
                    <span className="text-sm text-fog">Call logs</span>
                    <span className="text-sm font-semibold text-ember">→</span>
                  </Link>
                </div>
              </section>

              {/* Recent leads — the honest stand-in for an activity feed until
                  an activities table exists */}
              <section className="rounded-xl border border-seam bg-coal lg:col-span-3">
                <div className="border-b border-seam px-4 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                    Recent leads
                  </h2>
                </div>
                {recentLeads.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-fog">
                    No calls answered yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-seam">
                    {recentLeads.map((lead) => {
                      const stage = STAGE_DISPLAY.find(
                        (s) => s.stage === lead.pipeline_stage
                      );
                      return (
                        <li
                          key={lead.lead_id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-cream">
                              {lead.customer_name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-ash">
                              {lead.plumbing_issue}
                            </p>
                          </div>
                          {stage && (
                            <span
                              className={`hidden shrink-0 text-xs font-medium sm:block ${stage.text}`}
                            >
                              {stage.label}
                            </span>
                          )}
                          <EmergencyBadge level={lead.emergency_level} />
                          <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-ash">
                            {relativeTime(lead.created_at)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
