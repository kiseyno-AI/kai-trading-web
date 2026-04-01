"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { Topbar } from "@/components/navigation/topbar";
import type { DashboardSnapshotDto, NavItemDto, SearchSuggestionDto } from "@/types/trading-api";

const DEFAULT_NAV_ITEMS: NavItemDto[] = [
  { id: "dashboard", label: "Dashboard", icon: "DB", href: "/dashboard", description: "Primary command surface" },
  { id: "search", label: "Search", icon: "SR", href: "/search", description: "Symbol and route lookup" },
  { id: "markets", label: "Markets", icon: "MK", href: "/markets", description: "Market breadth and screening" },
  { id: "bots", label: "Bots", icon: "BT", href: "/bots", description: "Automation operations" },
];

const DEFAULT_SUGGESTIONS: SearchSuggestionDto[] = [
  { id: "dashboard", label: "Open dashboard", type: "route", route: "/dashboard" },
  { id: "search", label: "Open search workspace", type: "route", route: "/search" },
  { id: "markets", label: "Open market radar", type: "route", route: "/markets" },
  { id: "bots", label: "Open automation control", type: "route", route: "/bots" },
];

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
  const resolvedNavItems = navItems.length > 0 ? navItems : DEFAULT_NAV_ITEMS;
  const resolvedSuggestions = suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  return (
    <div className="dashboard-shell">
      <AppSidebar items={resolvedNavItems} currentPath={currentPath} />

      <main className="main-layout">
        <Topbar
          currentPath={currentPath}
          title={title}
          eyebrow={eyebrow}
          suggestions={resolvedSuggestions}
          onToggleMobileNav={() => setMobileNavOpen((value) => !value)}
        />
        <MobileNav open={mobileNavOpen} items={resolvedNavItems} currentPath={currentPath} />
        {children}
      </main>
    </div>
  );
}
