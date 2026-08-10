import type {
  AssignmentDirection,
  BusAssignmentRow,
  BusRow,
  RegistrationRow,
  StartingPointRow,
} from "@/lib/types";
import { assignToBusAction, copyOutboundToReturnAction } from "@/lib/actions/busAssignments";
import { AutoSubmitSelect } from "./AutoSubmitSelect";

export function BusAssignmentBoard({
  eventId,
  direction,
  registrations,
  buses,
  startingPoints,
  assignments,
  showCopyFromOutbound,
}: {
  eventId: string;
  direction: AssignmentDirection;
  registrations: RegistrationRow[];
  buses: BusRow[];
  startingPoints: StartingPointRow[];
  assignments: BusAssignmentRow[];
  showCopyFromOutbound: boolean;
}) {
  const assignedBusOf = (registrationId: string) =>
    assignments.find((a) => a.registration_id === registrationId)?.bus_id ?? "";

  const countInBus = (busId: string) =>
    assignments.filter((a) => a.bus_id === busId).length;

  return (
    <div className="space-y-8">
      {showCopyFromOutbound && (
        <form
          action={copyOutboundToReturnAction.bind(
            null,
            eventId,
            registrations.map((r) => r.id),
          )}
        >
          <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100">
            Copiar asignación de ida como punto de partida
          </button>
        </form>
      )}

      {startingPoints.map((sp) => {
        const spBuses = buses.filter((b) => b.starting_point_id === sp.id);
        const spRegistrations = registrations.filter((r) => r.starting_point_id === sp.id);

        return (
          <section key={sp.id} className="space-y-3">
            <h2 className="font-semibold">{sp.name}</h2>
            <div className="flex flex-wrap gap-2 text-xs text-neutral-600">
              {spBuses.map((bus) => (
                <span key={bus.id} className="rounded-full bg-neutral-100 px-3 py-1">
                  Micro {bus.bus_number}: {countInBus(bus.id)}/{bus.capacity}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2">DNI</th>
                    <th className="px-4 py-2">Micro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {spRegistrations.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        {r.last_name}, {r.first_name}
                      </td>
                      <td className="px-4 py-2">{r.dni}</td>
                      <td className="px-4 py-2">
                        <form action={assignToBusAction.bind(null, eventId, direction, r.id)}>
                          <AutoSubmitSelect
                            name="bus_id"
                            defaultValue={assignedBusOf(r.id)}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            options={spBuses.map((b) => ({
                              value: b.id,
                              label: `Micro ${b.bus_number} (${countInBus(b.id)}/${b.capacity})`,
                            }))}
                          />
                        </form>
                      </td>
                    </tr>
                  ))}
                  {spRegistrations.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-neutral-500">
                        No hay inscriptos confirmados desde {sp.name}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
