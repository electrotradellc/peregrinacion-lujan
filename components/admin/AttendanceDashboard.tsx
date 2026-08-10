"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AssignmentDirection,
  AttendanceCheckinRow,
  BusRow,
  StopRow,
} from "@/lib/types";

export function AttendanceDashboard({
  buses,
  stops,
  initialCheckins,
}: {
  buses: BusRow[];
  stops: StopRow[];
  initialCheckins: AttendanceCheckinRow[];
}) {
  const [direction, setDirection] = useState<AssignmentDirection>("outbound");
  const [checkins, setCheckins] = useState<AttendanceCheckinRow[]>(initialCheckins);

  useEffect(() => {
    const supabase = createClient();
    const busIds = new Set(buses.map((b) => b.id));

    const channel = supabase
      .channel("attendance-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_checkins" },
        (payload) => {
          const row = payload.new as AttendanceCheckinRow;
          if (!busIds.has(row.bus_id)) return;
          setCheckins((prev) => [...prev, row]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "attendance_checkins" },
        (payload) => {
          const row = payload.old as { id: string };
          setCheckins((prev) => prev.filter((c) => c.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [buses]);

  const countAt = (busId: string, stopId: string, eventType: "arrival" | "departure") =>
    checkins.filter(
      (c) =>
        c.bus_id === busId &&
        c.stop_id === stopId &&
        c.direction === direction &&
        c.event_type === eventType,
    ).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setDirection("outbound")}
          className={`rounded-md px-3 py-1.5 ${direction === "outbound" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
        >
          Ida
        </button>
        <button
          onClick={() => setDirection("return")}
          className={`rounded-md px-3 py-1.5 ${direction === "return" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
        >
          Vuelta
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Muestra lo que ya sincronizó cada capitán — un micro sin señal no se actualiza hasta
        que recupere conexión.
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2">Micro</th>
              {stops.map((stop) => (
                <th key={stop.id} className="px-3 py-2">
                  {stop.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {buses.map((bus) => (
              <tr key={bus.id}>
                <td className="px-3 py-2 font-medium">Micro {bus.bus_number}</td>
                {stops.map((stop) => (
                  <td key={stop.id} className="px-3 py-2 text-xs">
                    Llegada: {countAt(bus.id, stop.id, "arrival")} · Salida:{" "}
                    {countAt(bus.id, stop.id, "departure")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
