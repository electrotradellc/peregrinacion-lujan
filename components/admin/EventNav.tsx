"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const base = `/admin/eventos/${eventId}`;
  const isAsistenciaRoute = pathname === `${base}/asistencia`;
  const isVuelta = isAsistenciaRoute && searchParams.get("direction") === "return";

  const items = [
    { href: `${base}/config`, label: "Config", active: pathname === `${base}/config` },
    { href: `${base}/inscripciones`, label: "Inscripciones", active: pathname === `${base}/inscripciones` },
    { href: `${base}/asistencia`, label: "Asistencia", active: isAsistenciaRoute && !isVuelta },
    { href: `${base}/asistencia?direction=return`, label: "Vuelta", active: isVuelta },
  ];

  return (
    <div className="relative border-b border-neutral-200 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-base font-medium text-neutral-900"
        aria-expanded={open}
      >
        <span aria-hidden className="text-xl leading-none">☰</span>
        Menú
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <nav className="absolute left-0 top-full z-20 min-w-48 rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm ${
                  item.active
                    ? "bg-neutral-100 font-semibold text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
