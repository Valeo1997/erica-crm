'use client';

import Link from 'next/link';
import { DragEvent, use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';

/* Columns are keyed strictly to the pipeline_stage enum values. Colors ramp
   with stage progress — brightest accent on Closed Won. */
const COLUMNS: {
  stage: Lead['pipeline_stage'];
  label: string;
  dot: string;
  headerClass: string;
}[] = [
  {
    stage: 'new_lead',
    label: 'New Lead',
    dot: 'bg-ash',
    headerClass: 'text-ash',
  },
  {
    stage: 'contacted',
    label: 'Contacted',
    dot: 'bg-fog',
    headerClass: 'text-fog',
  },
  {
    stage: 'qualified',
    label: 'Qualified',
    dot: 'bg-cream',
    headerClass: 'text-cream',
  },
  {
    stage: 'proposal_sent',
    label: 'Proposal Sent',
    dot: 'bg-ember',
    headerClass: 'text-ember',
  },
  {
    stage: 'closed_won',
    label: 'Closed Won',
    dot: 'bg-flare',
    headerClass: 'text-flare',
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Lead['pipeline_stage'] | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
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

  const handleDragStart = (e: DragEvent<HTMLElement>, lead: Lead) => {
    e.dataTransfer.setData('text/plain', lead.lead_id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(lead.lead_id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleColumnDragOver = (e: DragEvent<HTMLElement>, stage: Lead['pipeline_stage']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) setDragOverStage(stage);
  };

  /* The CRM owns pipeline_stage — drops persist. Optimistic: move the card
     immediately, revert if the write fails. */
  const handleDrop = async (e: DragEvent<HTMLElement>, stage: Lead['pipeline_stage']) => {
    e.preventDefault();
    setDragOverStage(null);
    setDraggingId(null);
    const leadId = e.dataTransfer.getData('text/plain');
    const lead = leads.find((l) => l.lead_id === leadId);
    if (!lead || lead.pipeline_stage === stage) return;

    setMoveError(null);
    setLeads((prev) =>
      prev.map((l) => (l.lead_id === leadId ? { ...l, pipeline_stage: stage } : l))
    );
    const { error } = await supabase
      .from('plumbing_leads')
      .update({ pipeline_stage: stage })
      .eq('lead_id', leadId);
    if (error) {
      console.error('Failed to move lead:', error.message);
      setLeads((prev) =>
        prev.map((l) =>
          l.lead_id === leadId ? { ...l, pipeline_stage: lead.pipeline_stage } : l
        )
      );
      setMoveError(`Couldn't move ${lead.customer_name} — ${error.message}`);
    }
  };

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
              Drag a lead to its next stage — changes save here.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {moveError && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {moveError}
          </p>
        )}

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

        {/* Stage board */}
        {!isLoading && leads.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-start">
          {COLUMNS.map((column) => {
            const columnLeads = leads.filter(
              (lead) => lead.pipeline_stage === column.stage
            );
            const isDropTarget = dragOverStage === column.stage;
            return (
              <section
                key={column.stage}
                onDragOver={(e) => handleColumnDragOver(e, column.stage)}
                onDragLeave={() => setDragOverStage((s) => (s === column.stage ? null : s))}
                onDrop={(e) => handleDrop(e, column.stage)}
                className={`rounded-xl border transition-colors ${
                  isDropTarget
                    ? 'border-ember/60 bg-ember/[0.06]'
                    : 'border-seam bg-coal/50'
                }`}
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
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onDragEnd={handleDragEnd}
                        className={`relative cursor-grab rounded-lg border p-4 active:cursor-grabbing ${
                          draggingId === lead.lead_id ? 'opacity-40' : ''
                        } ${
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
                            <Link
                              href={`/crm/${sub_account_id}/leads/${lead.lead_id}`}
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                              className="transition-colors hover:text-ember"
                            >
                              {lead.customer_name}
                            </Link>
                          </h3>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <EmergencyBadge level={lead.emergency_level} />
                            <Link
                              href={`/crm/${sub_account_id}/leads/${lead.lead_id}`}
                              aria-label={`Open ${lead.customer_name}`}
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                              className="rounded-md p-1 text-ash transition-colors hover:bg-soot hover:text-cream"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                className="h-4 w-4"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                                />
                              </svg>
                            </Link>
                          </div>
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
