import { createClient } from "@/lib/supabase/server";
import type { PaymentRow, RegistrationRow } from "@/lib/types";

export default async function PagosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: registrations } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", id)
    .returns<RegistrationRow[]>();

  const registrationIds = (registrations ?? []).map((r) => r.id);
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .in("registration_id", registrationIds.length ? registrationIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false })
    .returns<PaymentRow[]>();

  const registrationLabel = (regId: string) => {
    const r = registrations?.find((r) => r.id === regId);
    return r ? `${r.last_name}, ${r.first_name} (DNI ${r.dni})` : regId;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pagos</h1>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-4 py-2">Inscripto</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Monto</th>
              <th className="px-4 py-2">MP Payment ID</th>
              <th className="px-4 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(payments ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">{registrationLabel(p.registration_id)}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">${p.amount ?? "-"}</td>
                <td className="px-4 py-2">{p.mp_payment_id ?? "-"}</td>
                <td className="px-4 py-2">{new Date(p.created_at).toLocaleString("es-AR")}</td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Todavía no hay pagos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
