import Link from "next/link";

const tabs = [
  { href: "config", label: "Config" },
  { href: "inscripciones", label: "Inscripciones" },
  { href: "asistencia", label: "Asistencia" },
];

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 border-b border-neutral-200 text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={`/admin/eventos/${id}/${tab.href}`}
            className="rounded-t-md px-3 py-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
