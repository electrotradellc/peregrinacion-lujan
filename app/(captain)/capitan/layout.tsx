import Image from "next/image";
import Link from "next/link";
import { requireBusCaptain } from "@/lib/auth";
import { SignOutButton } from "@/components/admin/SignOutButton";

export default async function CaptainLayout({ children }: { children: React.ReactNode }) {
  const session = await requireBusCaptain();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <Image
            src="/logo.png"
            alt="Parroquia San Isidro Labrador"
            width={424}
            height={186}
            className="h-8 w-auto shrink-0"
          />
          <Link href="/capitan/perfil" className="font-medium hover:underline">
            {session.profile.full_name}
          </Link>
        </div>
        <SignOutButton />
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
    </div>
  );
}
