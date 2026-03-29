import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "glass" | "pill" | "primary";
  active?: boolean;
  leadingIcon?: ReactNode;
};

export function Button({ className, variant = "glass", active, leadingIcon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn("ui-button", `ui-button-${variant}`, active && "is-active", className)}
      {...props}
    >
      {leadingIcon ? <span className="ui-button-icon">{leadingIcon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
