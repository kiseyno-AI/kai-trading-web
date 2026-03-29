import { DashboardView } from "@/features/dashboard/dashboard-view";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardPage() {
  return (
    <AppShell currentPath="/dashboard" title="Trading Command Surface" eyebrow="Precision & Clarity">
      <DashboardView />
    </AppShell>
  );
}
