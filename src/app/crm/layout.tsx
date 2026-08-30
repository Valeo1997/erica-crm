import SignOutButton from './SignOutButton';

export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <aside className="flex items-center justify-end gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        {/* client-selector dropdown placeholder */}
        <SignOutButton />
      </aside>
      <main>{children}</main>
    </div>
  );
}
