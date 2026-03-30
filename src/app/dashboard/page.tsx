"use client";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { useDashboardSnapshot } from "@/lib/use-dashboard-snapshot";

export default function DashboardPage() {
  const { snapshot, loading } = useDashboardSnapshot();

  return (
    <AppShell
      currentPath="/dashboard"
      title="Trading Command Surface"
      eyebrow="Precision & Clarity"
      navItems={snapshot?.nav ?? []}
      suggestions={snapshot?.searchSuggestions ?? []}
    >
      <div className="glass section-card" style={{ marginBottom: 16 }}>DEBUG_DASHBOARD_PAGE_V2</div>
      {loading || !snapshot ? (
        <section className="content-grid">
          <div className="glass section-card">Loading market surface…</div>
        </section>
      ) : (
        <DashboardView snapshot={snapshot} />
      )}
    </AppShell>
  );
}
