'use client';

import { Fragment, use, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';

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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/* Deterministic UTC formatting so server and client render identically. */
function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${hour12}:${minutes} ${ampm} UTC`;
}

export default function CallLogsPage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    supabase
      .from('plumbing_leads')
      .select('*')
      .eq('sub_account_id', sub_account_id)
      .order('created_at', { ascending: false })
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

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return leads.filter((lead) => {
      const haystack = [
        lead.customer_name,
        lead.customer_phone,
        lead.customer_address,
        lead.plumbing_issue,
      ]
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) return true;
      return (
        digits.length > 0 &&
        lead.customer_phone.replace(/\D/g, '').includes(digits)
      );
    });
  }, [leads, query]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Call Logs
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Every call answered by the AI receptionist, newest first.
            </p>
          </div>
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {/* Search */}
        <div className="relative mb-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, address, or issue…"
            aria-label="Search call logs"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Showing{' '}
          <span className="font-semibold tabular-nums">
            {filteredLeads.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold tabular-nums">{leads.length}</span>{' '}
          calls
        </p>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-14 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
            Loading call logs…
          </p>
        )}

        {!isLoading && leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-14 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
            No calls yet for this account.
          </p>
        )}

        {/* Table */}
        {!isLoading && leads.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                <th scope="col" className="px-4 py-3 sm:px-6">
                  Customer
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 sm:px-6">
                  Phone
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6">
                  Emergency
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-3 sm:px-6">
                  Call Time
                </th>
                <th scope="col" className="px-4 py-3 sm:px-6">
                  <span className="sr-only">Transcript</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredLeads.map((lead) => {
                const isExpanded = expandedId === lead.lead_id;
                return (
                  <Fragment key={lead.lead_id}>
                    <tr
                      onClick={() =>
                        setExpandedId((cur) =>
                          cur === lead.lead_id ? null : lead.lead_id
                        )
                      }
                      className="cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="px-4 py-4 sm:px-6">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                          {lead.customer_name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {lead.customer_address}
                        </p>
                        <p className="mt-1 max-w-xs truncate text-xs text-neutral-400 dark:text-neutral-500">
                          {lead.plumbing_issue}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-top font-mono text-sm text-neutral-700 dark:text-neutral-300 sm:px-6">
                        {lead.customer_phone}
                      </td>
                      <td className="px-4 py-4 align-top sm:px-6">
                        <EmergencyBadge level={lead.emergency_level} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-neutral-600 dark:text-neutral-300 sm:px-6">
                        {formatTimestamp(lead.created_at)}
                      </td>
                      <td className="px-4 py-4 align-top text-right sm:px-6">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`Transcript for ${lead.customer_name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId((cur) =>
                              cur === lead.lead_id ? null : lead.lead_id
                            );
                          }}
                          className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-neutral-50/70 dark:bg-neutral-800/30">
                        <td colSpan={5} className="px-4 py-5 sm:px-6">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            Transcript ·{' '}
                            <span className="font-mono normal-case">
                              {lead.call_id}
                            </span>
                          </p>
                          {lead.transcript ? (
                            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                              {lead.transcript}
                            </p>
                          ) : (
                            <p className="text-sm italic text-neutral-400 dark:text-neutral-500">
                              No transcript recorded for this call.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-14 text-center text-sm text-neutral-400 dark:text-neutral-500"
                  >
                    No calls match{' '}
                    <span className="font-medium text-neutral-600 dark:text-neutral-300">
                      {query}
                    </span>
                    . Try a different name, phone number, or address.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
