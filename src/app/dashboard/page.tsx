import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { tradingApi } from "@/lib/trading-api";

export default async function DashboardPage() {
  const response = await tradingApi.getDashboardSnapshot();
  const snapshot = response.data;

  return (
    <AppShell
      currentPath="/dashboard"
      title="Trading Command Surface"
      eyebrow="Precision & Clarity"
      navItems={snapshot.nav}
      suggestions={snapshot.searchSuggestions}
    >
      <DashboardView snapshot={snapshot} />
    </AppShell>
  );
}
