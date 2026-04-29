import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SurfaceStateTone = "neutral" | "loading" | "warning" | "danger" | "success";

type SurfaceStateProps = {
  body?: ReactNode;
  children?: ReactNode;
  className?: string;
  title: ReactNode;
  tone?: SurfaceStateTone;
};

export function SurfaceState({
  body,
  children,
  className,
  title,
  tone = "neutral",
}: SurfaceStateProps) {
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";

  return (
    <div className={cn("surface-state", `surface-state-${tone}`, className)} role={role}>
      <strong>{title}</strong>
      {body || children ? <p>{body ?? children}</p> : null}
    </div>
  );
}
