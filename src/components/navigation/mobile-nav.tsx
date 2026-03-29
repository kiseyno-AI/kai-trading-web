"use client";

import Link from "next/link";

import type { NavItem } from "@/data/trading-dashboard";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  open: boolean;
  items: NavItem[];
  currentPath: string;
};

export function MobileNav({ open, items, currentPath }: MobileNavProps) {
  return (
    <Drawer open={open} className="mobile-nav">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className={cn("mobile-nav-item", currentPath === item.href && "active")}>
          <span>{item.icon}</span>
          <em>{item.label}</em>
        </Link>
      ))}
    </Drawer>
  );
}
