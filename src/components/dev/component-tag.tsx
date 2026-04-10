"use client";

import { useState } from "react";

import { useAppState } from "@/components/providers/app-state-provider";

type ComponentTagProps = {
  label: string;
  api?: string;
  placement?: "inline" | "corner";
};

export function ComponentTag({ label, api, placement = "corner" }: ComponentTagProps) {
  const { devMode } = useAppState();
  const [copied, setCopied] = useState(false);

  if (!devMode) {
    return null;
  }

  const copyText = api ? `${label}\n${api}` : label;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={`component-tag component-tag-${placement}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleCopy();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          void handleCopy();
        }
      }}
      role="button"
      tabIndex={0}
      title="Copy component tag"
    >
      <strong>{copied ? "Copied" : label}</strong>
      {api ? <span>{api}</span> : null}
    </div>
  );
}
