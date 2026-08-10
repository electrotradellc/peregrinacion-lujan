"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/login");
      }}
      className="rounded-md border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
    >
      Salir
    </button>
  );
}
