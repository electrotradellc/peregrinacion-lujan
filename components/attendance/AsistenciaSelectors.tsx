"use client";

import { useRouter } from "next/navigation";
import type { AssignmentDirection } from "@/lib/types";

export function AsistenciaSelectors({
  basePath,
  direction,
  busId,
  stopId,
  buses,
  stops,
}: {
  basePath: string;
  direction: AssignmentDirection;
  busId: string;
  stopId: string;
  buses: { id: string; bus_number: number }[];
  stops: { id: string; sequence_order: number; name: string }[];
}) {
  const router = useRouter();

  function navigate(overrides: Record<string, string>) {
    const params = new URLSearchParams({ busId, direction, stopId, ...overrides });
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2">
        <span className="font-medium text-neutral-600">Micro</span>
        <select
          value={busId}
          onChange={(e) => navigate({ busId: e.target.value })}
          className="rounded-md border border-neutral-300 px-3 py-1.5"
        >
          <option value="all">Todos</option>
          {buses.map((b) => (
            <option key={b.id} value={b.id}>
              Micro {b.bus_number}
            </option>
          ))}
        </select>
      </label>

      {direction !== "return" && (
        <label className="flex items-center gap-2">
          <span className="font-medium text-neutral-600">Parada</span>
          <select
            value={stopId}
            onChange={(e) => navigate({ stopId: e.target.value })}
            className="rounded-md border border-neutral-300 px-3 py-1.5"
          >
            {stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sequence_order}. {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
