"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DrawerProps = {
  open: boolean;
  className?: string;
  children: ReactNode;
};

export function Drawer({ open, className, children }: DrawerProps) {
  return <div className={cn("drawer-panel glass", open && "open", className)}>{children}</div>;
}
