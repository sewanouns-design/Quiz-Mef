import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import DashboardClient from "@/components/admin/DashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  return <DashboardClient />;
}
