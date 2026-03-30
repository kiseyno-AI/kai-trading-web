"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { Topbar } from "@/components/navigation/topbar";
import type { DashboardSnapshotDto } from "@/types/trading-api";

type AppShellProps = {
  currentPath: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
  navItems?: DashboardSnapshotDto["nav"];
  suggestions?: DashboardSnapshotDto["searchSuggestions"];
};

export function AppShell({ currentPath, title, eyebrow, children, navItems = [], suggestions = [] }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      <AppSidebar items={navItems} currentPath={currentPath} />

      <main className="main-layout">
        <Topbar
          title={title}
          eyebrow={eyebrow}
          suggestions={suggestions}
          onToggleMobileNav={() => setMobileNavOpen((value) => !value)}
        />
        <MobileNav open={mobileNavOpen} items={navItems} currentPath={currentPath} />
        {children}
      </main>
    </div>
  );
}
