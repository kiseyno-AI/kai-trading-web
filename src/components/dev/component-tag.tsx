"use client";

import { useState } from "react";

import { useAppState } from "@/components/providers/app-state-provider";

type ComponentTagProps = {
  label: string;
  api?: string;
  placement?: "inline" | "corner";
};

const TAG_IDS: Record<string, string> = {
  "dashboard.core-unavailable": "D1",
  "dashboard.operational-integrity": "D2",
  "dashboard.piotroski-board": "D4",
  "dashboard.momentum-board": "D4",
  "search.terminal-shell": "Q1",
  "search.quick-access": "Q3",
  "search.trending-symbols": "Q4",
  "search.desktop-results-table": "Q6",
  "symbol.hero": "S1",
  "symbol.errors": "S2",
  "symbol.chart": "S3",
  "symbol.action-summary": "S4",
  "symbol.technical-analysis": "S5",
  "symbol.fundamentals-history": "S6",
  "symbol.disclosures": "S7",
  "symbol.system-freshness": "S8",
};

function resolveTagId(label: string) {
  return TAG_IDS[label] ?? label;
}

export function ComponentTag({ label, api, placement = "corner" }: ComponentTagProps) {
  const { devMode, t } = useAppState();
  const [copied, setCopied] = useState(false);
  const tagId = resolveTagId(label);

  if (!devMode) {
    return null;
  }

  const copyText = api ? `${tagId}\n${label}\n${api}` : `${tagId}\n${label}`;

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
      title={t.common.copyComponentTag}
    >
      <strong>{copied ? t.common.copied : tagId}</strong>
      {api ? <span>{api}</span> : null}
    </div>
  );
}
