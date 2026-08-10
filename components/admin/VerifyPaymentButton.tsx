"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyPaymentButton({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registrationId }),
          });
          const json = await res.json();
          setLoading(false);
          if (!res.ok) {
            setMessage(json.error ?? "Error al verificar el pago");
            return;
          }
          if (json.confirmed) {
            setMessage("Pago encontrado y confirmado.");
            router.refresh();
          } else {
            setMessage("Todavía no encontramos un pago aprobado para esta inscripción.");
          }
        }}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
      >
        {loading ? "Verificando..." : "Verificar pago en Mercado Pago"}
      </button>
      {message && <p className="mt-2 text-sm text-neutral-600">{message}</p>}
    </div>
  );
}
