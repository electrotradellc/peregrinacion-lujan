// Labels/clases de estado de inscripción, compartidas entre Server y Client
// Components. A propósito NO viven en InscripcionesTable.tsx (que es "use
// client"): importar un const desde un módulo "use client" en un Server
// Component rompe en producción — del lado del servidor llega como una
// referencia opaca, no el objeto real, así que `Object.entries(...)` da
// vacío y las píldoras de estado desaparecen sin ningún error visible.
export const statusLabel: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

export const statusClass: Record<string, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-200 text-neutral-600",
};
