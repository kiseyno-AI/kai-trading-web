"use client";

import { useAppState } from "@/components/providers/app-state-provider";

type ComponentTagProps = {
  label: string;
  api?: string;
  placement?: "inline" | "corner";
};

export function ComponentTag({ label, api, placement = "corner" }: ComponentTagProps) {
  const { devMode } = useAppState();

  if (!devMode) {
    return null;
  }

  return (
    <div className={`component-tag component-tag-${placement}`}>
      <strong>{label}</strong>
      {api ? <span>{api}</span> : null}
    </div>
  );
}
