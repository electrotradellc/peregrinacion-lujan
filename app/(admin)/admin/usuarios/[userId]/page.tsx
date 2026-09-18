import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, EventRow, BusRow, BusCaptainAssignmentRow } from "@/lib/types";
import { EventBusPicker } from "@/components/admin/EventBusPicker";
import { updateUserAction, resendInviteAction } from "../actions";

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ saved?: string; invited?: string }>;
}) {
  const { userId } = await params;
  const { saved, invited } = await searchParams;
  const supabase = await createClient();

  const [{ data: profile }, { data: events }, { data: buses }, { data: assignments }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single<ProfileRow>(),
      supabase.from("events").select("*").order("event_date", { ascending: false }).returns<EventRow[]>(),
      supabase.from("buses").select("*").returns<BusRow[]>(),
      supabase
        .from("bus_captain_assignments")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .returns<BusCaptainAssignmentRow[]>(),
    ]);

  if (!profile) notFound();

  const currentAssignment = assignments?.[0] ?? null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-neutral-500 hover:underline">
          ← Usuarios
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{profile.full_name}</h1>
      </div>

      {saved === "1" && (
        <div className="rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          ✓ Cambios guardados
        </div>
      )}
      {invited === "1" && (
        <div className="rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          ✓ Invitación reenviada por email
        </div>
      )}

      <form
        action={updateUserAction.bind(null, userId)}
        className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2"
      >
        <div>
          <label className="text-sm font-medium">Nombre completo</label>
          <input
            name="full_name"
            required
            defaultValue={profile.full_name}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">WhatsApp (+54911...)</label>
          <input
            name="whatsapp_phone"
            defaultValue={profile.whatsapp_phone ?? ""}
            placeholder="+5491122334455"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Rol</label>
          <select
            name="role"
            defaultValue={profile.role}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="bus_captain">Referente de micro</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <EventBusPicker
          events={events ?? []}
          buses={buses ?? []}
          defaultEventId={currentAssignment?.event_id ?? ""}
          defaultBusId={currentAssignment?.bus_id ?? ""}
        />
        <div className="sm:col-span-2">
          <button className="rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white">
            Guardar cambios
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-semibold">Acceso</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Si a esta persona se le venció el link de la invitación antes de definir su
          contraseña, le podés mandar uno nuevo.
        </p>
        <form action={resendInviteAction.bind(null, userId)} className="mt-3">
          <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100">
            Reenviar invitación por email
          </button>
        </form>
      </div>
    </div>
  );
}
