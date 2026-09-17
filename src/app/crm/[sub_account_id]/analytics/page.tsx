'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';
import { STAGE_DISPLAY, StatCard } from '@/app/crm/components/record-ui';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const EMERGENCY_BAR: Record<string, string> = {
  emergency: 'bg-red-500',
  urgent: 'bg-ember',
  routine: 'bg-fog',
  standard: 'bg-fog',
};
const EMERGENCY_FALLBACK_BAR = 'bg-ash';

/* Hand-rolled SVG area+line chart (no chart lib allowed). Always renders the
   last 6 months so the axis stays continuous even with sparse data. */
function VolumeChart({ data }: { data: { label: string; count: number }[] }) {
  const W = 600;
  const H = 180;
  const PAD_X = 28;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 28;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + innerH;
  const max = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    ...d,
    x: PAD_X + i * stepX,
    y: baseY - (d.count / max) * innerH,
  }));
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Lead volume over the last 6 months"
    >
      <defs>
        <linearGradient id="volume-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={PAD_X} y1={baseY} x2={W - PAD_X} y2={baseY} className="stroke-seam" strokeWidth="1" />
      <path d={areaPath} fill="url(#volume-fill)" />
      <path d={linePath} fill="none" className="stroke-ember" strokeWidth="2" />
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="3" className="fill-ember" />
          {p.count > 0 && (
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              fontSize="11"
              className="fill-fog tabular-nums"
            >
              {p.count}
            </text>
          )}
          <text
            x={p.x}
            y={H - 8}
            textAnchor="middle"
            fontSize="11"
            className="fill-ash"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function AnalyticsPage({
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
        .eq('sub_account_id', sub_account_id),
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

  const derived = useMemo(() => {
    const total = leads.length;
    const closedWon = leads.filter((l) => l.pipeline_stage === 'closed_won').length;
    const conversion = total > 0 ? Math.round((closedWon / total) * 100) : 0;
    const emergencies = leads.filter(
      (l) => l.emergency_level.toLowerCase() === 'emergency'
    ).length;

    // Conversion funnel — leads that reached at least each stage
    const funnel = STAGE_DISPLAY.map((s, i) => ({
      ...s,
      value: leads.filter(
        (l) => STAGE_DISPLAY.findIndex((x) => x.stage === l.pipeline_stage) >= i
      ).length,
    }));

    // Leads by stage
    const byStage = STAGE_DISPLAY.map((s) => ({
      ...s,
      value: leads.filter((l) => l.pipeline_stage === s.stage).length,
    }));

    // Emergency-level breakdown (free text — group whatever shows up)
    const levelCounts = new Map<string, number>();
    for (const l of leads) {
      const level = l.emergency_level.toLowerCase() || 'unknown';
      levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
    }
    const byEmergency = [...levelCounts.entries()]
      .map(([level, value]) => ({
        level,
        value,
        bar: EMERGENCY_BAR[level] ?? EMERGENCY_FALLBACK_BAR,
      }))
      .sort((a, b) => b.value - a.value);

    // Last 6 months of lead volume
    const now = new Date();
    const buckets: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: MONTHS[d.getMonth()],
        count: 0,
      });
    }
    const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
    for (const l of leads) {
      const d = new Date(l.created_at);
      const bucket = bucketByKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.count += 1;
    }

    return { total, closedWon, conversion, emergencies, funnel, byStage, byEmergency, volume: buckets };
  }, [leads]);

  const hasLeads = leads.length > 0;

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Analytics
            </h1>
            <p className="mt-2 text-sm text-fog">
              Pipeline health for this account.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading analytics…
          </p>
        )}

        {!isLoading && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Leads" value={derived.total} />
              <StatCard label="Closed won" value={derived.closedWon} />
              <StatCard label="Conversion" value={`${derived.conversion}%`} />
              <StatCard label="Emergencies" value={derived.emergencies} />
              <StatCard label="Contacts" value={contactCount} />
              <StatCard label="Companies" value={companyCount} />
            </div>

            {!hasLeads && (
              <p className="mt-4 rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
                No leads yet — charts appear once calls start coming in.
              </p>
            )}

            {hasLeads && (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Conversion funnel */}
                <section className="rounded-xl border border-seam bg-coal">
                  <div className="border-b border-seam px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                      Conversion funnel
                    </h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {derived.funnel.map((s) => {
                      const first = derived.funnel[0].value || 1;
                      const pct = Math.round((s.value / first) * 100);
                      return (
                        <div key={s.stage} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-sm text-fog">{s.label}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-soot">
                            <span
                              className={`block h-full rounded-full ${s.bar}`}
                              style={{ width: `${Math.max(pct, s.value > 0 ? 3 : 0)}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-cream">
                            {s.value}
                          </span>
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ash">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Leads by stage */}
                <section className="rounded-xl border border-seam bg-coal">
                  <div className="border-b border-seam px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                      Leads by stage
                    </h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {derived.byStage.map((s) => {
                      const maxVal = Math.max(...derived.byStage.map((x) => x.value), 1);
                      const pct = (s.value / maxVal) * 100;
                      return (
                        <div key={s.stage} className="flex items-center gap-3">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                          <span className="w-28 shrink-0 text-sm text-fog">{s.label}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-soot">
                            <span
                              className={`block h-full rounded-full ${s.bar}`}
                              style={{ width: `${Math.max(pct, s.value > 0 ? 3 : 0)}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-cream">
                            {s.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Lead volume */}
                <section className="rounded-xl border border-seam bg-coal lg:col-span-2">
                  <div className="border-b border-seam px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                      Lead volume — last 6 months
                    </h2>
                  </div>
                  <div className="p-4">
                    <VolumeChart data={derived.volume} />
                  </div>
                </section>

                {/* Emergency breakdown */}
                <section className="rounded-xl border border-seam bg-coal lg:col-span-2">
                  <div className="border-b border-seam px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                      Emergency levels
                    </h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {derived.byEmergency.map((e) => {
                      const pct = Math.round((e.value / derived.total) * 100);
                      return (
                        <div key={e.level} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-sm capitalize text-fog">
                            {e.level}
                          </span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-soot">
                            <span
                              className={`block h-full rounded-full ${e.bar}`}
                              style={{ width: `${Math.max(pct, 3)}%` }}
                            />
                          </span>
                          <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-cream">
                            {e.value}
                          </span>
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ash">
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
