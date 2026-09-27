import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { District, Province } from "@/lib/location-types";
import { getCurrentAdmin } from "@/lib/server/session";
import districts from "@/src/generated/districts.json";
import provinces from "@/src/generated/provinces.json";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let admin: Awaited<ReturnType<typeof getCurrentAdmin>> = null;
  try {
    admin = await getCurrentAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!admin) redirect("/admin/login");
  return (
    <AdminDashboard
      email={admin.email}
      provinces={provinces as Province[]}
      districts={districts as District[]}
    />
  );
}
