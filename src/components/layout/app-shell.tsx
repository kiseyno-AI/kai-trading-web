"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AppSidebar } from "@/components/navigation/app-sidebar";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { Topbar } from "@/components/navigation/topbar";
import { useAppState } from "@/components/providers/app-state-provider";
import { resolveRouteMessageKey } from "@/i18n/messages";
import { buildAppChromeNavItems, buildAppChromeSearchSuggestions } from "@/lib/app-chrome-routes";
import { logWebDiagnostic } from "@/lib/web-diagnostics";
import type { DashboardSnapshotDto } from "@/types/trading-api";

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
  const resolvedNavItems = navItems.length > 0 ? navItems : buildAppChromeNavItems(t);
  const resolvedSuggestions = suggestions.length > 0 ? suggestions : buildAppChromeSearchSuggestions(t);
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
