import Link from 'next/link';
import NavLinks from './NavLinks';
import SignOutButton from './SignOutButton';

function BrandMark({ tag }: { tag: string }) {
  return (
    <Link href="/crm" className="flex items-baseline gap-2">
      <span className="font-display text-lg font-semibold tracking-tight text-cream">
        Ericka
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ember">
        {tag}
      </span>
    </Link>
  );
}

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-ink text-cream">
      {/* Sidebar — md and up only */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-seam bg-coal md:flex">
        <div className="flex h-14 items-center border-b border-seam px-4">
          <BrandMark tag="AI Dispatcher" />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ash">
            Views
          </p>
          <ul className="space-y-0.5">
            <NavLinks variant="sidebar" />
          </ul>
        </nav>

        <div className="border-t border-seam px-4 py-3">
          <p className="text-[11px] leading-snug text-ash">
            Ericka&rsquo;s Desk &mdash; your system of record.
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — below md */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-seam bg-coal px-3 md:hidden">
          <BrandMark tag="CRM" />
          <nav className="flex items-center gap-1">
            <NavLinks variant="topbar" />
          </nav>
          <SignOutButton />
        </header>

        {/* Desktop top nav */}
        <header className="hidden h-14 shrink-0 items-center justify-between border-b border-seam bg-coal px-5 md:flex">
          {/* Left: client-selector dropdown placeholder */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ash">Account:</span>
            {/* TODO: replace with a real <ClientSelector> client component */}
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-md border border-seam bg-soot px-2.5 py-1 text-xs text-fog opacity-60"
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
