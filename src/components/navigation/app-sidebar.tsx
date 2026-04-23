"use client";

import Link from "next/link";

import { useAppState } from "@/components/providers/app-state-provider";
import type { NavItemDto } from "@/types/trading-api";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  items: NavItemDto[];
  currentPath: string;
};

export function AppSidebar({ items, currentPath }: AppSidebarProps) {
  const { t } = useAppState();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand-block">
        <Link href="/dashboard" className="brand-mark" aria-label={t.navigation.goToDashboard}>
          KAI
        </Link>
        <div className="sidebar-brand-copy">
          <strong>{t.navigation.brandTitle}</strong>
          <span>{t.navigation.sidebarSubtitle}</span>
        </div>
      </div>
      <nav className="side-nav">
        {items.map((item) => {
          const active = currentPath === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn("nav-icon", active && "active")}
              aria-label={item.label}
              title={item.label}
            >
              <span className="nav-icon-glyph" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-copy">
                <span className="nav-icon-label">{item.label}</span>
                <span className="nav-icon-description">{item.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-section-label">{t.navigation.workspace}</div>
        <Link href="/dashboard#settings" className="nav-icon" aria-label={t.navigation.settings} title={t.navigation.settings}>
          <span className="nav-icon-glyph" aria-hidden="true">
            CFG
          </span>
          <span className="nav-copy">
            <span className="nav-icon-label">{t.navigation.settings}</span>
            <span className="nav-icon-description">{t.navigation.settingsDescription}</span>
          </span>
        </Link>
        <div className="sidebar-summary">
          <span>{t.navigation.mode}</span>
          <strong>{t.navigation.modeValue}</strong>
        </div>
      </div>
    </aside>
  );
}
