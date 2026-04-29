"use client";

import Link from "next/link";

import { useAppState } from "@/components/providers/app-state-provider";
import type { NavItemDto } from "@/types/trading-api";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  items: NavItemDto[];
  currentPath: string;
};

export function NavGlyph({ id }: { id: string }) {
  if (id === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "portfolio") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8.5H20V18.5C20 19.6 19.1 20.5 18 20.5H6C4.9 20.5 4 19.6 4 18.5V8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 8.5V6.5C8 5.4 8.9 4.5 10 4.5H14C15.1 4.5 16 5.4 16 6.5V8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 13H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "calendar") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 4.5V7.5M17.5 4.5V7.5M4.5 9H19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4.5" y="6" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (id === "markets") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 17L9 12L13 15L20 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (id === "bots") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 3.5V7M15 3.5V7M9 12H9.01M15 12H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 18.5H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

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
                <NavGlyph id={item.id} />
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
