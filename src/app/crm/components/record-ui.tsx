'use client';

import Link from 'next/link';
import { ReactNode, useEffect } from 'react';
import { Lead } from '@/lib/types';

/* Stage display config — brightness ramps with progress, brightest on
   Closed Won. Shared by dashboard and analytics. */
export const STAGE_DISPLAY: {
  stage: Lead['pipeline_stage'];
  label: string;
  dot: string;
  text: string;
  bar: string;
}[] = [
  { stage: 'new_lead', label: 'New Lead', dot: 'bg-ash', text: 'text-ash', bar: 'bg-ash' },
  { stage: 'contacted', label: 'Contacted', dot: 'bg-fog', text: 'text-fog', bar: 'bg-fog' },
  { stage: 'qualified', label: 'Qualified', dot: 'bg-cream', text: 'text-cream', bar: 'bg-cream' },
  { stage: 'proposal_sent', label: 'Proposal Sent', dot: 'bg-ember', text: 'text-ember', bar: 'bg-ember' },
  { stage: 'closed_won', label: 'Closed Won', dot: 'bg-flare', text: 'text-flare', bar: 'bg-flare' },
];

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-fog">
        {label}
      </span>
      <span className="mt-2 block font-display text-3xl tabular-nums leading-none text-cream">
        {value}
      </span>
      {hint && <span className="mt-2 block text-xs text-ash">{hint}</span>}
    </>
  );
  const className = 'block rounded-xl border border-seam bg-coal p-4 text-left';
  if (href) {
    return (
      <Link href={href} className={`${className} transition-colors hover:border-ash`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export const inputClass =
  'w-full rounded-lg border border-seam bg-soot px-3 py-2.5 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20';

export const labelClass =
  'mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-fog';

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-ember px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-flare disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-seam bg-soot px-3.5 py-2.5 text-sm font-medium text-cream transition-colors hover:border-ash disabled:cursor-not-allowed disabled:opacity-50';

export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      <button
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
      />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-seam bg-coal p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl uppercase leading-none tracking-tight text-cream">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-fog transition-colors hover:bg-soot hover:text-cream"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
