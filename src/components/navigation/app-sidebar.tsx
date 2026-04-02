import Link from "next/link";

import type { NavItemDto } from "@/types/trading-api";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  items: NavItemDto[];
  currentPath: string;
};

export function AppSidebar({ items, currentPath }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand-block">
        <Link href="/dashboard" className="brand-mark" aria-label="Go to Dashboard">
          KAI
        </Link>
        <div className="sidebar-brand-copy">
          <strong>Sovereign Desk</strong>
          <span>Realtime command workspace</span>
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
        <div className="sidebar-section-label">Workspace</div>
        <Link href="/dashboard#settings" className="nav-icon" aria-label="Settings" title="Settings">
          <span className="nav-icon-glyph" aria-hidden="true">
            CFG
          </span>
          <span className="nav-copy">
            <span className="nav-icon-label">Settings</span>
            <span className="nav-icon-description">Desk preferences and alerts</span>
          </span>
        </Link>
        <div className="sidebar-summary">
          <span>Mode</span>
          <strong>Stitch refresh</strong>
        </div>
      </div>
    </aside>
  );
}
