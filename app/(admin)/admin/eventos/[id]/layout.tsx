import { EventNav } from "@/components/admin/EventNav";

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
      <EventNav eventId={id} />
      {children}
    </div>
  );
}
