import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { getCurrentAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  try {
    if (await getCurrentAdmin()) redirect("/admin");
  } catch {
    // The login screen remains available so configuration errors can be surfaced safely.
  }
  return <AdminLoginForm />;
}
