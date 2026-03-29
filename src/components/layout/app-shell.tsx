"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { Topbar } from "@/components/navigation/topbar";
import { useDashboardSnapshot } from "@/lib/use-dashboard-snapshot";

type AppShellProps = {
  currentPath: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function AppShell({ currentPath, title, eyebrow, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const snapshot = useDashboardSnapshot();

  return (
    <div className="dashboard-shell">
      <AppSidebar items={snapshot?.nav ?? []} currentPath={currentPath} />

      <main className="main-layout">
        <Topbar
          title={title}
          eyebrow={eyebrow}
          suggestions={snapshot?.searchSuggestions ?? []}
          onToggleMobileNav={() => setMobileNavOpen((value) => !value)}
        />
        <MobileNav open={mobileNavOpen} items={snapshot?.nav ?? []} currentPath={currentPath} />
        {children}
      </main>
    </div>
  );
}
