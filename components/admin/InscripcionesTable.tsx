"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RegistrationRow, StartingPointRow, BusRow, BusAssignmentRow } from "@/lib/types";
import { DeleteRegistrationButton } from "@/components/admin/DeleteRegistrationButton";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import { AutoSubmitCheckbox } from "@/components/admin/AutoSubmitCheckbox";
import { assignToBusAction } from "@/lib/actions/busAssignments";
import { setReturnsIndependentlyAction } from "@/lib/actions/registrations";
import { setRegistrationStatusAction } from "@/app/(admin)/admin/eventos/[id]/inscripciones/[registrationId]/actions";
import { calculateAge } from "@/lib/age";
import { statusLabel, statusClass } from "@/lib/registrationStatus";

type Sort = "recent" | "name" | "code";

// Condiciones médicas del formulario de inscripción, con el detalle que
// cargó la persona (si esa condición lo pide) para mostrarlo al filtrar.
const MEDICAL_CONDITIONS: {
  value: string;
  label: string;
  has: (r: RegistrationRow) => boolean;
  detail?: (r: RegistrationRow) => string | null;
}[] = [
  { value: "allergies", label: "Alergias", has: (r) => r.has_allergies, detail: (r) => r.allergies_detail },
  { value: "celiac", label: "Celiaquía", has: (r) => r.has_celiac },
  { value: "diabetes", label: "Diabetes", has: (r) => r.has_diabetes },
  { value: "hypertension", label: "Hipertensión", has: (r) => r.has_hypertension },
  { value: "respiratory", label: "Enf. respiratoria", has: (r) => r.has_respiratory_condition },
  { value: "heart", label: "Enf. cardíaca", has: (r) => r.has_heart_condition },
  { value: "medication", label: "Toma medicación", has: (r) => r.takes_medication, detail: (r) => r.medication_detail },
  { value: "other", label: "Otra condición", has: (r) => r.has_other_condition, detail: (r) => r.other_condition_detail },
];

const hasAnyCondition = (r: RegistrationRow) => MEDICAL_CONDITIONS.some((c) => c.has(r));

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "font-semibold text-neutral-900" : "hover:underline"}
    >
      {children}
    </button>
  );
}

export function InscripcionesTable({
  eventId,
  registrations,
  startingPoints,
  buses,
  assignments,
  eventDate,
}: {
  eventId: string;
  registrations: RegistrationRow[];
  startingPoints: StartingPointRow[];
  buses: BusRow[];
  assignments: BusAssignmentRow[];
  eventDate: string | undefined;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [startingPointId, setStartingPointId] = useState("");
  const [busIda, setBusIda] = useState("");
  const [onlyMinors, setOnlyMinors] = useState(false);
  const [onlyIndependentJoiners, setOnlyIndependentJoiners] = useState(false);
  const [onlyIndependentReturners, setOnlyIndependentReturners] = useState(false);
  const [medical, setMedical] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const medicalCondition = MEDICAL_CONDITIONS.find((c) => c.value === medical);
  // Los conteos del desplegable no incluyen canceladas: no van a la
  // peregrinación, y sumarlas confunde para planificar (ej. comida sin TACC).
  const activeRegistrations = registrations.filter((r) => r.status !== "cancelled");
  const medicalCount = (has: (r: RegistrationRow) => boolean) => activeRegistrations.filter(has).length;

  const spName = (spId: string) => startingPoints.find((sp) => sp.id === spId)?.name ?? "?";
  // El micro de vuelta no se asigna acá sino en Vuelta (lista propia de micros).
  const assignedBus = (registrationId: string) =>
    assignments.find((a) => a.registration_id === registrationId && a.direction === "outbound")?.bus_id ?? "";
  // Las canceladas no ocupan lugar (la base les borra la asignación al cancelar;
  // el filtro cubre las que quedaron de antes de ese cambio).
  const cancelledIds = new Set(registrations.filter((r) => r.status === "cancelled").map((r) => r.id));
  const countInBus = (busId: string) =>
    assignments.filter(
      (a) => a.bus_id === busId && a.direction === "outbound" && !cancelledIds.has(a.registration_id),
    ).length;

  const filtered = useMemo(() => {
    let rows = registrations;
    if (status) rows = rows.filter((r) => r.status === status);
    if (startingPointId) rows = rows.filter((r) => r.starting_point_id === startingPointId);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.first_name.toLowerCase().includes(needle) ||
          r.last_name.toLowerCase().includes(needle) ||
          r.dni.includes(needle) ||
          String(r.pilgrim_code ?? "").includes(needle),
      );
    }
    if (busIda) {
      rows = rows.filter((r) =>
        busIda === "unassigned" ? !assignedBus(r.id) : assignedBus(r.id) === busIda,
      );
    }
    if (onlyMinors && eventDate) {
      rows = rows.filter((r) => calculateAge(r.birth_date, eventDate) < 18);
    }
    if (onlyIndependentJoiners) {
      rows = rows.filter((r) => r.joins_independently);
    }
    if (onlyIndependentReturners) {
      rows = rows.filter((r) => r.returns_independently);
    }
    // Sin canceladas, igual que los números del desplegable: el filtro es para
    // planificar (ej. cuántos celíacos van), y así lista y número coinciden.
    if (medical === "any") {
      rows = rows.filter((r) => r.status !== "cancelled" && hasAnyCondition(r));
    } else if (medicalCondition) {
      rows = rows.filter((r) => r.status !== "cancelled" && medicalCondition.has(r));
    }

    return [...rows].sort((a, b) => {
      if (sort === "name") {
        return (
          a.last_name.localeCompare(b.last_name, "es") || a.first_name.localeCompare(b.first_name, "es")
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    registrations,
    q,
    status,
    startingPointId,
    busIda,
    onlyMinors,
    onlyIndependentJoiners,
    onlyIndependentReturners,
    medical,
    sort,
  ]);

  return (
    <>
      <div className="flex flex-wrap gap-3 text-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, DNI o nro"
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
          value={startingPointId}
          onChange={(e) => setStartingPointId(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Todos los puntos de partida</option>
          {startingPoints.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.name}
            </option>
          ))}
        </select>
        <select
          value={busIda}
          onChange={(e) => setBusIda(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Micro (ida): todos</option>
          <option value="unassigned">Micro (ida): sin asignar</option>
          {buses.map((b) => (
            <option key={b.id} value={b.id}>
              Micro (ida): {b.bus_number} ({countInBus(b.id)}/{b.capacity})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5">
          <input type="checkbox" checked={onlyMinors} onChange={(e) => setOnlyMinors(e.target.checked)} />
          Solo menores
        </label>
        <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5">
          <input
            type="checkbox"
            checked={onlyIndependentJoiners}
            onChange={(e) => setOnlyIndependentJoiners(e.target.checked)}
          />
          Solo se unen por su cuenta
        </label>
        <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5">
          <input
            type="checkbox"
            checked={onlyIndependentReturners}
            onChange={(e) => setOnlyIndependentReturners(e.target.checked)}
          />
          Solo vuelven por su cuenta
        </label>
        <select
          value={medical}
          onChange={(e) => setMedical(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="">Condición médica: todas</option>
          <option value="any">Cualquier condición ({medicalCount(hasAnyCondition)})</option>
          {MEDICAL_CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} ({medicalCount(c.has)})
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-neutral-600">
        Mostrando <strong>{filtered.length}</strong> de {registrations.length} inscripciones
        {medical && " · el filtro de condición médica no incluye inscripciones canceladas"}
      </p>

      <div className="scrollbar-visible max-h-[65vh] overflow-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-4 py-2">
                <SortButton active={sort === "name"} onClick={() => setSort("name")}>
                  Apellido, Nombre
                </SortButton>
              </th>
              <th className="px-4 py-2">DNI</th>
              <th className="px-4 py-2">Punto de partida</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">
                <SortButton active={sort === "code"} onClick={() => setSort("code")}>
                  Nro
                </SortButton>
              </th>
              <th className="px-4 py-2">Micro (ida)</th>
              <th className="px-4 py-2">Vuelve por su cuenta</th>
              <th className="px-4 py-2">
                <SortButton active={sort === "recent"} onClick={() => setSort("recent")}>
                  Inscripto el
                </SortButton>
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((r) => {
              const spBuses = buses.filter((b) => b.starting_point_id === r.starting_point_id);
              const canAssign = r.status === "confirmed";
              const age = eventDate ? calculateAge(r.birth_date, eventDate) : null;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    {r.last_name}, {r.first_name}
                    {age !== null && age < 18 && (
                      <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                        Menor ({age})
                      </span>
                    )}
                    {r.joins_independently && (
                      <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800">
                        Se une por su cuenta
                      </span>
                    )}
                    {medicalCondition?.detail && medicalCondition.detail(r) && (
                      <div className="text-xs text-neutral-500">
                        {medicalCondition.label}: {medicalCondition.detail(r)}
                      </div>
                    )}
                    {medical === "any" && (
                      <div className="text-xs text-neutral-500">
                        {MEDICAL_CONDITIONS.filter((c) => c.has(r))
                          .map((c) => (c.detail?.(r) ? `${c.label} (${c.detail(r)})` : c.label))
                          .join(", ")}
                      </div>
                    )}
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
                      <form action={assignToBusAction.bind(null, eventId, "outbound", r.id)}>
                        <AutoSubmitSelect
                          name="bus_id"
                          defaultValue={assignedBus(r.id)}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          options={spBuses.map((b) => ({
                            value: b.id,
                            label: `Micro ${b.bus_number} (${countInBus(b.id)}/${b.capacity})`,
                          }))}
                        />
                      </form>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {canAssign ? (
                      <form action={setReturnsIndependentlyAction.bind(null, eventId, r.id)}>
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
                      timeZone: "America/Argentina/Buenos_Aires",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {r.status === "pending_payment" && (
                        <form action={setRegistrationStatusAction.bind(null, eventId, r.id, "confirmed")}>
                          <button
                            type="submit"
                            title="Marcar como pagada"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white hover:bg-green-800"
                          >
                            $
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/admin/eventos/${eventId}/inscripciones/${r.id}`}
                        className="text-neutral-600 hover:underline"
                      >
                        Ver
                      </Link>
                      {r.status === "cancelled" && (
                        <DeleteRegistrationButton eventId={eventId} registrationId={r.id} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-neutral-500">
                  No hay inscripciones con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
