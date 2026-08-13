"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleAddForm({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
      >
        + Nuevo
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {children}
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
        Cancelar
      </button>
    </div>
  );
}
