"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { countPending } from "@/lib/offline/syncQueue";
import { getServerSnapshot, getSnapshot, kickSync, startSyncLoop, subscribe } from "@/lib/offline/syncStatus";

// Indicador fijo del estado de la señal y de las marcas del celular. Se ve en
// la planilla y en el modo sin conexión; además de mostrarlo, arranca el ciclo
// de envío en segundo plano (uno solo por página).
export function SyncStatusBar() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pending = useLiveQuery(() => countPending(), [], 0) ?? 0;

  useEffect(() => {
    startSyncLoop();
  }, []);

  const marks = `${pending} marca${pending === 1 ? "" : "s"}`;
  let tone: "amber" | "blue" | "green" | "gray";
  let text: string;

  if (status.signal === "offline") {
    tone = "amber";
    text =
      pending > 0
        ? `Sin señal · ${marks} guardada${pending === 1 ? "" : "s"} en el celular, se envían solas al volver la señal`
        : "Sin señal";
  } else if (pending > 0 && status.syncing) {
    tone = "blue";
    text = `Enviando ${marks}…`;
  } else if (pending > 0) {
    tone = "amber";
    text = `${marks} sin enviar · reintentando`;
  } else if (status.signal === "online") {
    tone = "green";
    text = "Todo enviado ✓";
  } else {
    tone = "gray";
    text = "Verificando señal…";
  }

  const toneClass = {
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    blue: "border-blue-300 bg-blue-50 text-blue-900",
    green: "border-green-300 bg-green-50 text-green-900",
    gray: "border-neutral-200 bg-neutral-50 text-neutral-600",
  }[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm ${toneClass}`}
    >
      <span>{text}</span>
      {pending > 0 && !status.syncing && (
        <button
          type="button"
          onClick={kickSync}
          className="rounded-md border border-current px-2 py-0.5 text-xs font-medium"
        >
          Enviar ahora
        </button>
      )}
    </div>
  );
}
