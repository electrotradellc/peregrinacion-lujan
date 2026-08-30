import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { RegistrationRow, StartingPointRow, BusRow, BusAssignmentRow, EventRow } from "@/lib/types";
import { DeleteRegistrationButton } from "@/components/admin/DeleteRegistrationButton";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import { AutoSubmitCheckbox } from "@/components/admin/AutoSubmitCheckbox";
import { assignToBusAction } from "@/lib/actions/busAssignments";
import { setReturnsIndependentlyAction } from "@/lib/actions/registrations";
import { confirmBusAssignmentsAction, reopenBusAssignmentsAction } from "./actions";

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

type Filters = {
  status?: string;
  startingPointId?: string;
  q?: string;
  busIda?: string;
  busVuelta?: string;
  sort?: string;
};

function sortLink(id: string, filters: Filters, sort: string, label: string) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.startingPointId) params.set("startingPointId", filters.startingPointId);
  if (filters.busIda) params.set("busIda", filters.busIda);
  if (filters.busVuelta) params.set("busVuelta", filters.busVuelta);
  params.set("sort", sort);
  const active = (filters.sort ?? "recent") === sort;
  return (
    <Link
      href={`/admin/eventos/${id}/inscripciones?${params.toString()}`}
      className={active ? "font-semibold text-neutral-900" : "hover:underline"}
    >
      {label}
    </Link>
  );
}

export default async function InscripcionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Filters>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const supabase = await createClient();

  const [{ data: event }, { data: startingPoints }, { data: buses }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single<EventRow>(),
    supabase.from("starting_points").select("*").eq("event_id", id).returns<StartingPointRow[]>(),
    supabase.from("buses").select("*").eq("event_id", id).order("bus_number").returns<BusRow[]>(),
  ]);

  let query = supabase.from("registrations").select("*").eq("event_id", id);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startingPointId) query = query.eq("starting_point_id", filters.startingPointId);
  const { data: registrationsRaw } = await query.returns<RegistrationRow[]>();

  const busIds = (buses ?? []).map((b) => b.id);
  const { data: assignments } = busIds.length
    ? await supabase.from("bus_assignments").select("*").in("bus_id", busIds).returns<BusAssignmentRow[]>()
    : { data: [] as BusAssignmentRow[] };

  const spName = (spId: string) => startingPoints?.find((sp) => sp.id === spId)?.name ?? "?";
  const assignedBus = (registrationId: string, direction: "outbound" | "return") =>
    assignments?.find((a) => a.registration_id === registrationId && a.direction === direction)
      ?.bus_id ?? "";
  const countInBus = (busId: string, direction: "outbound" | "return") =>
    (assignments ?? []).filter((a) => a.bus_id === busId && a.direction === direction).length;

  const unassignedConfirmedCount = (registrationsRaw ?? []).filter(
    (r) => r.status === "confirmed" && !assignedBus(r.id, "outbound"),
  ).length;

  let registrations = registrationsRaw ?? [];
  if (filters.q) {
    const needle = filters.q.trim().toLowerCase();
    registrations = registrations.filter(
      (r) =>
        r.first_name.toLowerCase().includes(needle) ||
        r.last_name.toLowerCase().includes(needle) ||
        r.dni.includes(needle) ||
        String(r.pilgrim_code ?? "").includes(needle),
    );
  }
  if (filters.busIda) {
    registrations = registrations.filter((r) =>
      filters.busIda === "unassigned"
        ? !assignedBus(r.id, "outbound")
        : assignedBus(r.id, "outbound") === filters.busIda,
    );
  }
  if (filters.busVuelta) {
    registrations = registrations.filter((r) =>
      filters.busVuelta === "unassigned"
        ? !assignedBus(r.id, "return")
        : assignedBus(r.id, "return") === filters.busVuelta,
    );
  }

  const sort = filters.sort ?? "recent";
  registrations = [...registrations].sort((a, b) => {
    if (sort === "name") {
      return (
        a.last_name.localeCompare(b.last_name, "es") ||
        a.first_name.localeCompare(b.first_name, "es")
      );
    }
    if (sort === "code") {
      if (a.pilgrim_code === null && b.pilgrim_code === null) return 0;
      if (a.pilgrim_code === null) return 1;
      if (b.pilgrim_code === null) return -1;
      return a.pilgrim_code - b.pilgrim_code;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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

      {event?.bus_assignments_confirmed_at ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
          <span>
            ✓ Asignación de micros confirmada el{" "}
            {new Date(event.bus_assignments_confirmed_at).toLocaleString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Los inscriptos ya pueden ver su micro y contactar a su capitán en /mi-inscripcion.
          </span>
          <form action={reopenBusAssignmentsAction.bind(null, id)}>
            <button className="rounded-md border border-green-300 px-3 py-1 text-xs font-medium hover:bg-green-100">
              Reabrir asignación
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>
            La asignación de micros todavía no está confirmada — los inscriptos no ven su micro
            ni pueden contactar a su capitán hasta que confirmes.
            {unassignedConfirmedCount > 0 && (
              <> Hay {unassignedConfirmedCount} confirmado{unassignedConfirmedCount === 1 ? "" : "s"} sin micro de ida asignado.</>
            )}
          </span>
          <form action={confirmBusAssignmentsAction.bind(null, id)}>
            <button className="rounded-md bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white">
              Confirmar asignación de micros
            </button>
          </form>
        </div>
      )}

      <form className="flex flex-wrap gap-3 text-sm">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Buscar por nombre, DNI o nro"
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
        <select
          name="busIda"
          defaultValue={filters.busIda ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Micro (ida): todos</option>
          <option value="unassigned">Micro (ida): sin asignar</option>
          {(buses ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              Micro (ida): {b.bus_number} ({countInBus(b.id, "outbound")}/{b.capacity})
            </option>
          ))}
        </select>
        <select
          name="busVuelta"
          defaultValue={filters.busVuelta ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Micro (vuelta): todos</option>
          <option value="unassigned">Micro (vuelta): sin asignar</option>
          {(buses ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              Micro (vuelta): {b.bus_number} ({countInBus(b.id, "return")}/{b.capacity})
            </option>
          ))}
        </select>
        {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
        <button className="rounded-md bg-brand-ink px-3 py-1.5 text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-4 py-2">{sortLink(id, filters, "name", "Apellido, Nombre")}</th>
              <th className="px-4 py-2">DNI</th>
              <th className="px-4 py-2">Punto de partida</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">{sortLink(id, filters, "code", "Nro")}</th>
              <th className="px-4 py-2">Micro (ida)</th>
              <th className="px-4 py-2">Micro (vuelta)</th>
              <th className="px-4 py-2">Vuelve por su cuenta</th>
              <th className="px-4 py-2">{sortLink(id, filters, "recent", "Inscripto el")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {registrations.map((r) => {
              const spBuses = (buses ?? []).filter((b) => b.starting_point_id === r.starting_point_id);
              const canAssign = r.status === "confirmed";
              return (
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
                  <td className="px-4 py-2 font-mono text-neutral-700">{r.pilgrim_code ?? "—"}</td>
                  <td className="px-4 py-2">
                    {canAssign ? (
                      <form action={assignToBusAction.bind(null, id, "outbound", r.id)}>
                        <AutoSubmitSelect
                          name="bus_id"
                          defaultValue={assignedBus(r.id, "outbound")}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          options={spBuses.map((b) => ({
                            value: b.id,
                            label: `Micro ${b.bus_number} (${countInBus(b.id, "outbound")}/${b.capacity})`,
                          }))}
                        />
                      </form>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {canAssign && !r.returns_independently ? (
                      <form action={assignToBusAction.bind(null, id, "return", r.id)}>
                        <AutoSubmitSelect
                          name="bus_id"
                          defaultValue={assignedBus(r.id, "return")}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          options={spBuses.map((b) => ({
                            value: b.id,
                            label: `Micro ${b.bus_number} (${countInBus(b.id, "return")}/${b.capacity})`,
                          }))}
                        />
                      </form>
                    ) : (
                      <span className="text-neutral-400">
                        {r.returns_independently ? "vuelve por su cuenta" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {canAssign ? (
                      <form action={setReturnsIndependentlyAction.bind(null, id, r.id)}>
                        <AutoSubmitCheckbox
                          name="returns_independently"
                          defaultChecked={r.returns_independently}
                        />
                      </form>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {new Date(r.created_at).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/eventos/${id}/inscripciones/${r.id}`}
                        className="text-neutral-600 hover:underline"
                      >
                        Ver
                      </Link>
                      {r.status === "cancelled" && (
                        <DeleteRegistrationButton eventId={id} registrationId={r.id} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {registrations.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-neutral-500">
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
