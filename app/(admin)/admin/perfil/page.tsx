import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default function AdminPerfilPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tu cuenta</h1>
      <ChangePasswordForm />
    </div>
  );
}
