'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface SubAccount {
  sub_account_id: string;
  company_name: string;
}

export default function CrmAccountPickerPage() {
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('crm_sub_accounts')
      .select('sub_account_id, company_name')
      .order('company_name', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Failed to load accounts:', error.message);
          setAccounts([]);
        } else {
          setAccounts((data ?? []) as SubAccount[]);
        }
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative min-h-full overflow-hidden px-4 py-10 sm:px-8">
      <div
        className="ember-glow pointer-events-none absolute inset-x-0 top-0 h-72"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
          Ericka · Command Center
        </p>
        <h1 className="mt-3 font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
          Choose an account
        </h1>
        <p className="mt-2 text-sm text-fog">
          Each account mirrors a GoHighLevel sub-account.
        </p>

        <div className="mt-8">
          {isLoading && (
            <p className="rounded-xl border border-dashed border-seam px-4 py-10 text-center text-sm text-fog">
              Loading accounts…
            </p>
          )}

          {!isLoading && accounts.length === 0 && (
            <p className="rounded-xl border border-dashed border-seam px-4 py-10 text-center text-sm text-fog">
              No accounts found.
            </p>
          )}

          <ul className="space-y-2">
            {accounts.map((account) => (
              <li key={account.sub_account_id}>
                <Link
                  href={`/crm/${account.sub_account_id}/pipeline`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-seam bg-coal px-5 py-4 text-sm font-medium text-cream transition-colors hover:border-ember/50 hover:bg-soot"
                >
                  {account.company_name}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-4 w-4 shrink-0 text-ash transition-colors group-hover:text-ember"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
