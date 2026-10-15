import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { loadDashboard } from "@/features/dashboard/queries";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const { snapshot, hour } = loadDashboard();
  return <DashboardView snapshot={snapshot} name={null} hour={hour} />;
}
