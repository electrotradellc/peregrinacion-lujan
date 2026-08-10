import Link from "next/link";
import { requireBusCaptain } from "@/lib/auth";
import { SignOutButton } from "@/components/admin/SignOutButton";

export default async function CaptainLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBusCaptain();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <Link href="/capitan/perfil" className="font-medium hover:underline">
          {session.profile.full_name}
        </Link>
        <SignOutButton />
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
    </div>
  );
}
