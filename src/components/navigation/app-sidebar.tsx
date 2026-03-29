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
      <div className="brand-mark">PX</div>
      <nav className="side-nav">
        {items.slice(0, 4).map((item) => {
          const active = currentPath === item.href;
          return (
            <Link key={item.id} href={item.href} className={cn("nav-icon", active && "active")} aria-label={item.label}>
              {item.icon}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <Link href="/dashboard#settings" className="nav-icon" aria-label="Settings">
          ⚙
        </Link>
      </div>
    </aside>
  );
}
