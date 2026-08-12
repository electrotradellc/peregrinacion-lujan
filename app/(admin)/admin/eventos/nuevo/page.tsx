import Link from "next/link";
import { createEventAction } from "../actions";

export default function NuevoEventoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/eventos" className="text-sm text-neutral-600 hover:underline">
          ← Volver a Eventos
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Nuevo evento</h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <form action={createEventAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Fecha</label>
            <input
              name="event_date"
              type="date"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Precio (ARS)</label>
            <input
              name="registration_price_ars"
              type="number"
              min="0"
              step="0.01"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Crear evento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
