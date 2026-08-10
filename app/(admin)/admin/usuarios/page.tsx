import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, EventRow, BusRow, BusCaptainAssignmentRow } from "@/lib/types";
import { createCaptainAction } from "./actions";
import { EventBusPicker } from "@/components/admin/EventBusPicker";

export default async function UsuariosPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: events }, { data: buses }, { data: assignments }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("full_name").returns<ProfileRow[]>(),
      supabase.from("events").select("*").order("event_date", { ascending: false }).returns<EventRow[]>(),
      supabase.from("buses").select("*").returns<BusRow[]>(),
      supabase.from("bus_captain_assignments").select("*").returns<BusCaptainAssignmentRow[]>(),
    ]);

  const assignmentLabel = (profileId: string) => {
    const a = assignments?.find((a) => a.profile_id === profileId);
    if (!a) return "Sin micro asignado";
    const bus = buses?.find((b) => b.id === a.bus_id);
    const event = events?.find((e) => e.id === a.event_id);
    return bus && event ? `${event.name} — Micro ${bus.bus_number}` : "";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="text-sm text-neutral-600">
          Admin y referentes de micro. Cada uno accede con su propia cuenta.
        </p>
      </div>

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {(profiles ?? []).map((p) => (
          <li key={p.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.full_name}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
                {p.role === "admin" ? "Admin" : "Referente de micro"}
              </span>
            </div>
            <p className="text-neutral-500">
              {p.whatsapp_phone ?? "sin WhatsApp cargado"}
              {p.role === "bus_captain" && ` · ${assignmentLabel(p.id)}`}
            </p>
          </li>
        ))}
        {(profiles ?? []).length === 0 && (
          <li className="px-4 py-6 text-sm text-neutral-500">Todavía no hay usuarios.</li>
        )}
      </ul>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-semibold">Nuevo usuario</h2>
        <form action={createCaptainAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Nombre completo</label>
            <input
              name="full_name"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">WhatsApp (+54911...)</label>
            <input
              name="whatsapp_phone"
              placeholder="+5491122334455"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Rol</label>
            <select
              name="role"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="bus_captain">Referente de micro</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <EventBusPicker events={events ?? []} buses={buses ?? []} />
          <div className="sm:col-span-2">
            <button className="rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white">
              Crear usuario e invitar por email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
