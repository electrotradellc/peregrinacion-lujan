import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SignOutButton } from "@/components/admin/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <nav className="flex flex-nowrap items-center gap-4 text-sm font-medium">
            <Image
              src="/logo.png"
              alt="Parroquia San Isidro Labrador"
              width={424}
              height={186}
              className="h-8 w-auto shrink-0"
            />
            <Link href="/admin/eventos" className="shrink-0 text-neutral-900">
              Eventos
            </Link>
            <Link href="/admin/usuarios" className="shrink-0 text-neutral-600 hover:text-neutral-900">
              Usuarios
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-sm text-neutral-600">
            <Link href="/admin/perfil" className="hover:text-neutral-900">
              {session.profile.full_name}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
