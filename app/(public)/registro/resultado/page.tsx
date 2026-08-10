import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { magicLinkPath } from "@/lib/magicLink";
import type { RegistrationRow } from "@/lib/types";

// Esta página es SOLO para mensaje al usuario. La confirmación real de la
// inscripción ocurre exclusivamente en app/api/webhooks/mercadopago —los
// query params de este redirect vienen del navegador del usuario y Mercado
// Pago documenta que no deben usarse como fuente de verdad de pago.
export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const externalReference =
    typeof params.external_reference === "string" ? params.external_reference : undefined;

  let registration: RegistrationRow | null = null;
  if (externalReference) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("registrations")
      .select("*")
      .eq("id", externalReference)
      .maybeSingle<RegistrationRow>();
    registration = data ?? null;
  }

  const confirmed = registration?.status === "confirmed";

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      {confirmed ? (
        <>
          <h1 className="text-2xl font-semibold text-green-700">¡Inscripción confirmada!</h1>
          <p className="mt-4 text-neutral-600">
            Recibimos tu pago. Te enviamos un email con el detalle de tu inscripción y un link
            para consultarla en cualquier momento.
          </p>
          <Link
            href={magicLinkPath(registration!.id)}
            className="mt-6 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Ver mi inscripción
          </Link>
          <p className="mt-3 text-xs text-neutral-500">
            Guardá este link — es la forma de volver a ver tu inscripción más adelante.
          </p>
        </>
      ) : status === "rejected" ? (
        <>
          <h1 className="text-2xl font-semibold text-red-700">El pago fue rechazado</h1>
          <p className="mt-4 text-neutral-600">
            Podés volver a intentarlo desde el mismo link de inscripción. Tu lugar todavía no
            está confirmado.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Estamos confirmando tu pago</h1>
          <p className="mt-4 text-neutral-600">
            Puede tardar unos minutos. En cuanto se confirme, te va a llegar un email con el
            detalle de tu inscripción.
          </p>
        </>
      )}
    </main>
  );
}
