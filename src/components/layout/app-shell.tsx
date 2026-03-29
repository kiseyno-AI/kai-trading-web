"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { dashboardData } from "@/data/trading-dashboard";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { Topbar } from "@/components/navigation/topbar";

type AppShellProps = {
  currentPath: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function AppShell({ currentPath, title, eyebrow, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      <AppSidebar items={dashboardData.nav} currentPath={currentPath} />

      <main className="main-layout">
        <Topbar
          title={title}
          eyebrow={eyebrow}
          suggestions={dashboardData.searchSuggestions}
          onToggleMobileNav={() => setMobileNavOpen((value) => !value)}
        />
        <MobileNav open={mobileNavOpen} items={dashboardData.nav} currentPath={currentPath} />
        {children}
      </main>
    </div>
  );
}
