"use client";

import Link from "next/link";

import type { NavItemDto } from "@/types/trading-api";
import { Drawer } from "@/components/ui/drawer";
import { NavGlyph } from "@/components/navigation/app-sidebar";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  open: boolean;
  items: NavItemDto[];
  currentPath: string;
};

export function MobileNav({ open, items, currentPath }: MobileNavProps) {
  return (
    <Drawer open={open} className="mobile-nav">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className={cn("mobile-nav-item", currentPath === item.href && "active")}>
          <span className="nav-icon-glyph" aria-hidden="true">
            <NavGlyph id={item.id} />
          </span>
          <em>{item.label}</em>
        </Link>
      ))}
    </Drawer>
  );
}
