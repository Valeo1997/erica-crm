'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';

/* Columns are keyed strictly to the pipeline_stage enum values. */
const COLUMNS: {
  stage: Lead['pipeline_stage'];
  label: string;
  dot: string;
  headerClass: string;
}[] = [
  {
    stage: 'incoming',
    label: 'Incoming',
    dot: 'bg-ember',
    headerClass: 'text-ember',
  },
  {
    stage: 'active',
    label: 'AI Active',
    dot: 'bg-cream',
    headerClass: 'text-cream',
  },
  {
    stage: 'booked',
    label: 'Booked',
    dot: 'bg-fog',
    headerClass: 'text-fog',
  },
];

/* Relative time — enough precision for "7am check what happened overnight". */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

export default function PipelinePage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    supabase
      .from('plumbing_leads')
      .select('*')
      .eq('sub_account_id', sub_account_id)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Failed to load leads:', error.message);
          setLeads([]);
        } else {
          setLeads((data ?? []) as Lead[]);
        }
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [sub_account_id]);

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Pipeline
            </h1>
            <p className="mt-2 text-sm text-fog">
              Live status synced from GoHighLevel.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading leads…
          </p>
        )}

        {!isLoading && leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            No leads yet for this account.
          </p>
        )}

        {/* Status board — read-only; stage changes happen in GoHighLevel */}
        {!isLoading && leads.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
          {COLUMNS.map((column) => {
            const columnLeads = leads.filter(
              (lead) => lead.pipeline_stage === column.stage
            );
            return (
              <section
                key={column.stage}
                className="rounded-xl border border-seam bg-coal/50"
              >
                <div className="flex items-center justify-between border-b border-seam px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${column.dot}`} />
                    <h2
                      className={`text-xs font-semibold uppercase tracking-[0.15em] ${
                        column.headerClass
                      }`}
                    >
                      {column.label}
                    </h2>
                  </div>
                  <span className="rounded-full bg-soot px-2 py-0.5 text-xs font-medium tabular-nums text-fog">
                    {columnLeads.length}
                  </span>
                </div>

                <div className="space-y-2 p-3">
                  {columnLeads.map((lead) => {
                    const isEmergency =
                      lead.emergency_level.toLowerCase() === 'emergency';
                    return (
                      <article
                        key={lead.lead_id}
                        className={`relative rounded-lg border p-4 ${
                          isEmergency
                            ? 'border-red-500/30 bg-red-500/[0.06] pl-5'
                            : 'border-seam bg-coal'
                        }`}
                      >
                        {/* Emergency accent bar */}
                        {isEmergency && (
                          <span
                            className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-red-500"
                            aria-hidden="true"
                          />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold leading-snug text-cream">
                            {lead.customer_name}
                          </h3>
                          <EmergencyBadge level={lead.emergency_level} />
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm text-fog">
                          {lead.plumbing_issue}
                        </p>
                        <div className="mt-3 flex items-end justify-between gap-2 border-t border-seam pt-2.5">
                          <div className="space-y-1 text-xs text-ash">
                            <p className="font-mono text-fog">{lead.customer_phone}</p>
                            <p className="truncate max-w-[14ch] sm:max-w-none">{lead.customer_address}</p>
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-ash">
                            {relativeTime(lead.created_at)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                  {columnLeads.length === 0 && (
                    <p className="rounded-lg border border-dashed border-seam px-3 py-8 text-center text-xs text-ash">
                      No leads in this stage
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
