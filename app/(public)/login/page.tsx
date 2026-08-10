"use client";

import Image from "next/image";
import { useActionState } from "react";
import { signInAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, undefined);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16">
      <Image src="/logo.png" alt="Parroquia San Isidro Labrador" width={424} height={186} className="mb-6 h-auto w-48" priority />
      <h1 className="mb-6 text-2xl font-semibold">Ingresar</h1>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-800">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-800">Contraseña</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink-hover disabled:opacity-50"
        >
          {pending ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-500">
        Acceso exclusivo para organizadores y referentes de micro.
      </p>
    </main>
  );
}
