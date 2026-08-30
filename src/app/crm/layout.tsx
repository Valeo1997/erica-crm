export default function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <aside>{/* client-selector dropdown placeholder */}</aside>
      <main>{children}</main>
    </div>
  );
}
