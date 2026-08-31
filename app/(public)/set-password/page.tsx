"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Página a la que apuntan los links de invitación/recuperación de Supabase
// Auth. El cliente de supabase-js detecta automáticamente los tokens que
// vienen en el hash de la URL (#access_token=...) y abre la sesión — acá
// solo hace falta esperar a que eso pase y pedir la contraseña nueva.
export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // El cliente de @supabase/ssr (pensado para sesión por cookie) no
    // siempre detecta solo el #access_token que viene en el link de
    // invitación/recuperación — lo leemos a mano y abrimos la sesión
    // nosotros si hace falta.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data }) => {
        if (data.session) setReady(true);
        window.history.replaceState(null, "", window.location.pathname);
      });
    } else {
      // por si el evento ya disparó antes de montar el listener
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
      });
    }

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.replace(profile?.role === "admin" ? "/admin" : "/capitan");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Elegí tu contraseña</h1>

      {!ready ? (
        <p className="text-sm text-neutral-500">
          Verificando el link de invitación... si esto no cambia en unos segundos, es
          probable que el link haya expirado — pedile a un admin que te reenvíe la
          invitación.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800">
              Contraseña nueva
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800">
              Repetí la contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Guardando..." : "Guardar y entrar"}
          </button>
        </form>
      )}
    </main>
  );
}
