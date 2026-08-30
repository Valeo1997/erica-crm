import Link from 'next/link';
import SignOutButton from './SignOutButton';

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">
        {/* Logo / brand */}
        <div className="flex h-14 items-center border-b border-neutral-800 px-4">
          <span className="text-sm font-semibold tracking-tight text-neutral-100">
            Ericka <span className="font-normal text-neutral-400">CRM</span>
          </span>
        </div>

        {/* Primary nav — links are not sub_account_id-scoped here; the
            active sub-account is reflected in the URL and driven by the
            client-selector dropdown in the top bar. */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Views
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/crm"
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
              >
                {/* Pipeline icon */}
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
                Pipeline
              </Link>
            </li>
            <li>
              <Link
                href="/crm"
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
              >
                {/* Call logs icon */}
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
                Call Logs
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top nav */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4">
          {/* Left: client-selector dropdown placeholder */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Account:</span>
            {/* TODO: replace with a real <ClientSelector> client component */}
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400 opacity-60"
            >
              Select account
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-3 w-3"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
          </div>

          {/* Right: sign-out */}
          <SignOutButton />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
