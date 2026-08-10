import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, StartingPointRow } from "@/lib/types";

const statusLabel: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  payment_failed: "Pago fallido",
  expired: "Expirada",
  cancelled: "Cancelada",
};
const statusClass: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  payment_failed: "bg-red-100 text-red-800",
  expired: "bg-neutral-200 text-neutral-600",
  cancelled: "bg-neutral-200 text-neutral-600",
};

export default async function InscripcionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; startingPointId?: string; q?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const supabase = await createClient();

  const { data: startingPoints } = await supabase
    .from("starting_points")
    .select("*")
    .eq("event_id", id)
    .returns<StartingPointRow[]>();

  let query = supabase.from("registrations").select("*").eq("event_id", id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startingPointId) query = query.eq("starting_point_id", filters.startingPointId);
  if (filters.q) {
    query = query.or(
      `first_name.ilike.%${filters.q}%,last_name.ilike.%${filters.q}%,dni.ilike.%${filters.q}%`,
    );
  }
  const { data: registrations } = await query
    .order("created_at", { ascending: false })
    .returns<RegistrationRow[]>();

  const spName = (spId: string) => startingPoints?.find((sp) => sp.id === spId)?.name ?? "?";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inscripciones</h1>
        <a
          href={`/api/registrations/export?eventId=${id}`}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
        >
          Exportar CSV
        </a>
      </div>

      <form className="flex flex-wrap gap-3 text-sm">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Buscar por nombre o DNI"
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Todos los estados</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="startingPointId"
          defaultValue={filters.startingPointId ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Todos los puntos de partida</option>
          {(startingPoints ?? []).map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">DNI</th>
              <th className="px-4 py-2">Punto de partida</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(registrations ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  {r.last_name}, {r.first_name}
                </td>
                <td className="px-4 py-2">{r.dni}</td>
                <td className="px-4 py-2">{spName(r.starting_point_id)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/eventos/${id}/inscripciones/${r.id}`}
                    className="text-neutral-600 hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {(registrations ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No hay inscripciones con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
