'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';

/* Columns are keyed strictly to the pipeline_stage enum values. */
const COLUMNS: {
  stage: Lead['pipeline_stage'];
  label: string;
  dot: string;
  highlight: string;
}[] = [
  {
    stage: 'incoming',
    label: 'Incoming Leads',
    dot: 'bg-sky-500',
    highlight: 'ring-2 ring-sky-400/70 bg-sky-50 dark:bg-sky-500/5',
  },
  {
    stage: 'active',
    label: 'AI Voice Active',
    dot: 'bg-violet-500',
    highlight: 'ring-2 ring-violet-400/70 bg-violet-50 dark:bg-violet-500/5',
  },
  {
    stage: 'booked',
    label: 'Job Booked',
    dot: 'bg-emerald-500',
    highlight: 'ring-2 ring-emerald-400/70 bg-emerald-50 dark:bg-emerald-500/5',
  },
];

const EMERGENCY_STYLES: Record<string, string> = {
  emergency:
    'bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
  urgent:
    'bg-amber-100 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
  routine:
    'bg-emerald-100 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
};
const EMERGENCY_FALLBACK =
  'bg-neutral-100 text-neutral-600 ring-neutral-500/20 dark:bg-neutral-500/10 dark:text-neutral-400 dark:ring-neutral-500/30';

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
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Lead['pipeline_stage'] | null>(
    null
  );

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

  function handleDrop(stage: Lead['pipeline_stage']) {
    if (draggedId) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.lead_id === draggedId ? { ...lead, pipeline_stage: stage } : lead
        )
      );
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Pipeline
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Drag a card into another column to update the lead stage.
            </p>
          </div>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-14 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
            Loading leads…
          </p>
        )}

        {!isLoading && leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-14 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
            No leads yet for this account.
          </p>
        )}

        {/* Kanban board */}
        {!isLoading && leads.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
          {COLUMNS.map((column) => {
            const columnLeads = leads.filter(
              (lead) => lead.pipeline_stage === column.stage
            );
            const isTarget = dropTarget === column.stage;
            return (
              <section
                key={column.stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (!isTarget) setDropTarget(column.stage);
                }}
                onDragLeave={() =>
                  setDropTarget((t) => (t === column.stage ? null : t))
                }
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(column.stage);
                }}
                className={`rounded-xl border border-neutral-200 bg-white/60 transition-colors dark:border-neutral-800 dark:bg-neutral-900/40 ${
                  isTarget ? column.highlight : ''
                }`}
              >
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                    <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {column.label}
                    </h2>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {columnLeads.length}
                  </span>
                </div>

                <div className="min-h-40 space-y-3 p-3">
                  {columnLeads.map((lead) => (
                    <article
                      key={lead.lead_id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', lead.lead_id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedId(lead.lead_id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDropTarget(null);
                      }}
                      className={`cursor-grab rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-opacity active:cursor-grabbing dark:border-neutral-700 dark:bg-neutral-900 ${
                        draggedId === lead.lead_id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
                          {lead.customer_name}
                        </h3>
                        <EmergencyBadge level={lead.emergency_level} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                        {lead.plumbing_issue}
                      </p>
                      <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                        <p className="flex items-center gap-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                            />
                          </svg>
                          <span className="font-mono">{lead.customer_phone}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                            />
                          </svg>
                          <span className="truncate">{lead.customer_address}</span>
                        </p>
                      </div>
                    </article>
                  ))}
                  {columnLeads.length === 0 && (
                    <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-xs text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
                      Drop leads here
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
