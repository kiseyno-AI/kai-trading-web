import { type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

import styles from "./unit-refresh-frame.module.css";

type UnitRefreshFrameProps = {
  busy?: boolean;
  children: ReactNode;
  className?: string;
  label?: string;
  overlayClassName?: string;
};

export function UnitRefreshFrame({
  busy = false,
  children,
  className,
  label = "Refreshing",
  overlayClassName,
}: UnitRefreshFrameProps) {
  const descriptionId = useId();

  return (
    <div
      className={cn(styles.frame, className)}
      data-refreshing={busy ? "true" : "false"}
      aria-busy={busy || undefined}
      aria-describedby={busy ? descriptionId : undefined}
    >
      {children}

      {busy ? (
        <>
          <div className={cn(styles.overlay, styles.overlayVisible, overlayClassName)} aria-hidden="true">
            <span className={styles.badge}>
              <span className={styles.spinner} />
              <span>{label}</span>
            </span>
          </div>
          <span id={descriptionId} className={styles.srOnly}>
            {label}
          </span>
        </>
      ) : null}
    </div>
  );
}
