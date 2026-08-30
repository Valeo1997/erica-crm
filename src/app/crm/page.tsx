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
    <div className="min-h-screen bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
          Choose an account
        </h1>

        {isLoading && (
          <p className="text-sm text-neutral-400">Loading accounts…</p>
        )}

        {!isLoading && accounts.length === 0 && (
          <p className="text-sm text-neutral-400">No accounts found.</p>
        )}

        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={account.sub_account_id}>
              <Link
                href={`/crm/${account.sub_account_id}/pipeline`}
                className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                {account.company_name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
