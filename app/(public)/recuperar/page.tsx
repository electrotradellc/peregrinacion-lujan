import Image from "next/image";
import { resendMagicLinkAction } from "./actions";

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { enviado } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16">
      <Image
        src="/logo.png"
        alt="Parroquia San Isidro Labrador"
        width={424}
        height={186}
        className="mb-6 h-auto w-48"
        priority
      />
      <h1 className="mb-2 text-2xl font-semibold">¿Perdiste tu link?</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Poné el DNI y el email con el que te inscribiste — si encontramos una inscripción con
        esos datos, te mandamos el link para ver su estado por mail.
      </p>

      {enviado === "1" ? (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Si encontramos una inscripción con esos datos, te mandamos el link por mail. Revisá tu
          casilla (y la carpeta de spam) en unos minutos.
        </p>
      ) : (
        <form action={resendMagicLinkAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800">DNI</label>
            <input
              name="dni"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
          >
            Enviar
          </button>
        </form>
      )}
    </main>
  );
}
