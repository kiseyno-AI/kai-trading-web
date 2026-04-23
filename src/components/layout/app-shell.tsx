"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { Topbar } from "@/components/navigation/topbar";
import { useAppState } from "@/components/providers/app-state-provider";
import { resolveRouteMessageKey, type MessageTree } from "@/i18n/messages";
import { logWebDiagnostic } from "@/lib/web-diagnostics";
import type { DashboardSnapshotDto, NavItemDto, SearchSuggestionDto } from "@/types/trading-api";

function buildDefaultNavItems(t: MessageTree): NavItemDto[] {
  return [
    {
      id: "dashboard",
      label: t.navigation.items.dashboard.label,
      icon: "DB",
      href: "/dashboard",
      description: t.navigation.items.dashboard.description,
    },
    {
      id: "search",
      label: t.navigation.items.search.label,
      icon: "SR",
      href: "/search",
      description: t.navigation.items.search.description,
    },
    {
      id: "markets",
      label: t.navigation.items.markets.label,
      icon: "MK",
      href: "/markets",
      description: t.navigation.items.markets.description,
    },
    {
      id: "bots",
      label: t.navigation.items.bots.label,
      icon: "BT",
      href: "/bots",
      description: t.navigation.items.bots.description,
    },
  ];
}

function buildDefaultSuggestions(t: MessageTree): SearchSuggestionDto[] {
  return [
    { id: "dashboard", label: t.navigation.searchSuggestions.dashboard, type: "route", route: "/dashboard" },
    { id: "search", label: t.navigation.searchSuggestions.search, type: "route", route: "/search" },
    { id: "markets", label: t.navigation.searchSuggestions.markets, type: "route", route: "/markets" },
    { id: "bots", label: t.navigation.searchSuggestions.bots, type: "route", route: "/bots" },
  ];
}

type AppShellProps = {
  currentPath: string;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  compactMobileChrome?: boolean;
  navItems?: DashboardSnapshotDto["nav"];
  suggestions?: DashboardSnapshotDto["searchSuggestions"];
};

export function AppShell({
  currentPath,
  title,
  eyebrow,
  children,
  compactMobileChrome = false,
  navItems = [],
  suggestions = [],
}: AppShellProps) {
  const { t } = useAppState();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const routeCopy = t.routes[resolveRouteMessageKey(currentPath)];
  const resolvedNavItems = navItems.length > 0 ? navItems : buildDefaultNavItems(t);
  const resolvedSuggestions = suggestions.length > 0 ? suggestions : buildDefaultSuggestions(t);
  const handleToggleMobileNav = () => {
    setMobileNavOpen((value) => {
      const nextValue = !value;
      logWebDiagnostic("interaction", "mobile-nav-toggle", {
        currentPath,
        to: nextValue,
      });
      return nextValue;
    });
  };

  return (
    <div className="dashboard-shell">
      <AppSidebar items={resolvedNavItems} currentPath={currentPath} />

      <main className="main-layout">
        <Topbar
          currentPath={currentPath}
          title={title ?? routeCopy.title}
          eyebrow={eyebrow ?? routeCopy.eyebrow}
          compactMobileChrome={compactMobileChrome}
          suggestions={resolvedSuggestions}
          onToggleMobileNav={handleToggleMobileNav}
        />
        <MobileNav open={mobileNavOpen} items={resolvedNavItems} currentPath={currentPath} />
        {children}
      </main>
    </div>
  );
}
