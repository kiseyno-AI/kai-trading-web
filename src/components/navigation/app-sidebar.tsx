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
      <Link href="/dashboard" className="brand-mark" aria-label="Go to Dashboard">
        KAI
      </Link>
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
              <span className="nav-icon-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <Link href="/dashboard#settings" className="nav-icon" aria-label="Settings" title="Settings">
          <span className="nav-icon-glyph" aria-hidden="true">
            CFG
          </span>
          <span className="nav-icon-label">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
