"use client";

import { useState } from "react";
import type { ReturnBusRow } from "@/lib/types";
import { ReturnAssign } from "@/components/admin/ReturnAssign";
import { ReturnBoard } from "@/components/admin/ReturnBoard";
import type { ReturnAssignedPerson, ReturnPerson } from "@/components/admin/returnTypes";

type Tab = "assign" | "buses";

// Vuelta en dos solapas: "Asignar" (micros abiertos + pendientes con tildes) y
// "Micros" (todos, con su gente, también los que ya salieron). La asignación en
// curso (micro elegido y tildes) vive acá para no perderla al cambiar de solapa.
export function VueltaView({
  eventId,
  buses,
  countByBus,
  pending,
  assigned,
  independentCount,
  withdrawnCount,
}: {
  eventId: string;
  buses: ReturnBusRow[];
  countByBus: Record<string, number>;
  pending: ReturnPerson[];
  assigned: ReturnAssignedPerson[];
  independentCount: number;
  withdrawnCount: number;
}) {
  const [tab, setTab] = useState<Tab>("assign");
  const [targetBusId, setTargetBusId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const openCount = buses.filter((b) => b.departed_at === null).length;
  const tabs: [Tab, string][] = [
    ["assign", `Asignar (${pending.length} pendientes)`],
    ["buses", `Micros (${buses.length}${buses.length > openCount ? ` · ${buses.length - openCount} salieron` : ""})`],
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-neutral-200" role="tablist">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === value
                ? "border-neutral-900 font-semibold text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "assign" ? (
        <ReturnAssign
          eventId={eventId}
          pending={pending}
          buses={buses}
          countByBus={countByBus}
          targetBusId={targetBusId}
          onTargetBusChange={setTargetBusId}
          selected={selected}
          onSelectedChange={setSelected}
          assignedCount={assigned.length}
          independentCount={independentCount}
          withdrawnCount={withdrawnCount}
        />
      ) : (
        <ReturnBoard
          eventId={eventId}
          buses={buses}
          countByBus={countByBus}
          assigned={assigned}
          onAddPeople={(busId) => {
            setTargetBusId(busId);
            setTab("assign");
          }}
        />
      )}
    </div>
  );
}
