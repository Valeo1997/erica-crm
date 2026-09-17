'use client';

import { Fragment, use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Lead } from '@/lib/types';

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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/* Local-time formatting. Timestamps only render after the client-side
   fetch, so there's no server/client mismatch to guard against. */
function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hour12}:${minutes} ${ampm}`;
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
    <div className="min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Call Logs
            </h1>
            <p className="mt-2 text-sm text-fog">
              Every call answered by the AI receptionist, newest first.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
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
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
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
            className="w-full rounded-lg border border-seam bg-coal py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
          />
        </div>

        <p className="mb-3 text-xs text-ash">
          Showing{' '}
          <span className="font-semibold tabular-nums text-fog">
            {filteredLeads.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold tabular-nums text-fog">
            {leads.length}
          </span>{' '}
          calls
        </p>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading call logs…
          </p>
        )}

        {!isLoading && leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            No calls yet for this account.
          </p>
        )}

        {/* Table */}
        {!isLoading && leads.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-seam bg-coal">
          <table className="min-w-full divide-y divide-seam">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-ash">
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
            <tbody className="divide-y divide-seam">
              {filteredLeads.map((lead) => {
                const isExpanded = expandedId === lead.lead_id;
                const isEmergency =
                  lead.emergency_level.toLowerCase() === 'emergency';
                return (
                  <Fragment key={lead.lead_id}>
                    <tr
                      onClick={() =>
                        setExpandedId((cur) =>
                          cur === lead.lead_id ? null : lead.lead_id
                        )
                      }
                      className={`cursor-pointer transition-colors hover:bg-soot/60 ${
                        isEmergency ? 'bg-red-500/[0.05]' : ''
                      }`}
                    >
                      <td className="px-4 py-4 sm:px-6">
                        <p className="font-semibold text-cream">
                          {lead.customer_name}
                        </p>
                        <p className="mt-0.5 text-xs text-fog">
                          {lead.customer_address}
                        </p>
                        <p className="mt-1 max-w-xs truncate text-xs text-ash">
                          {lead.plumbing_issue}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-top font-mono text-sm text-fog sm:px-6">
                        {lead.customer_phone}
                      </td>
                      <td className="px-4 py-4 align-top sm:px-6">
                        <EmergencyBadge level={lead.emergency_level} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-fog sm:px-6">
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
                          className="rounded-md p-1 text-ash transition-colors hover:bg-soot hover:text-cream"
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
                      <tr className="bg-soot/40">
                        <td colSpan={5} className="px-4 py-6 sm:px-8">
                          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
                            Transcript ·{' '}
                            <span className="font-mono normal-case tracking-normal text-ash">
                              {lead.call_id}
                            </span>
                          </p>
                          {lead.transcript ? (
                            <p className="max-w-2xl whitespace-pre-line text-[15px] leading-7 text-cream/90">
                              {lead.transcript}
                            </p>
                          ) : (
                            <p className="text-sm italic text-ash">
                              No transcript recorded for this call.
                            </p>
                          )}
                          <Link
                            href={`/crm/${sub_account_id}/leads/${lead.lead_id}`}
                            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ember transition-colors hover:text-flare"
                          >
                            View lead
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
                    className="px-6 py-14 text-center text-sm text-fog"
                  >
                    No calls match{' '}
                    <span className="font-medium text-cream">{query}</span>. Try
                    a different name, phone number, or address.
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
