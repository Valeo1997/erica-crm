'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const VIEWS = [
  {
    key: 'pipeline',
    label: 'Pipeline',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122"
        />
      </svg>
    ),
  },
  {
    key: 'call-logs',
    label: 'Call Logs',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
        />
      </svg>
    ),
  },
] as const;

/* The layout is a server component and cannot know the active sub-account,
   so links are derived from the current URL here. On the picker (/crm)
   there is no id yet — links fall back to the picker. */
export default function NavLinks({
  variant = 'sidebar',
}: {
  variant?: 'sidebar' | 'topbar';
}) {
  const pathname = usePathname();
  const subAccountId = pathname.match(/^\/crm\/([^/]+)/)?.[1] ?? null;

  return (
    <>
      {VIEWS.map((view) => {
        const href = subAccountId
          ? `/crm/${subAccountId}/${view.key}`
          : '/crm';
        const isActive = subAccountId !== null && pathname === href;

        if (variant === 'topbar') {
          return (
            <Link
              key={view.key}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-ember/10 text-ember'
                  : 'text-fog hover:bg-soot hover:text-cream'
              }`}
            >
              {view.label}
            </Link>
          );
        }

        return (
          <li key={view.key}>
            <Link
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-ember/10 font-medium text-ember'
                  : 'text-fog hover:bg-soot hover:text-cream'
              }`}
            >
              {view.icon}
              {view.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}
