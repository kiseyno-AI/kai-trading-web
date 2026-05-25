"use client";

import { useAppState } from "@/components/providers/app-state-provider";

import styles from "./dev-mode-toggle.module.css";

type DevModeToggleProps = {
  tabIndex?: number;
};

export function DevModeToggle({ tabIndex }: DevModeToggleProps) {
  const { devMode, setDevMode, t } = useAppState();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${devMode ? styles.active : ""}`.trim()}
      aria-pressed={devMode}
      tabIndex={tabIndex}
      onClick={() => setDevMode(!devMode)}
    >
      {devMode ? t.common.tagsOn : t.common.tagsOff}
    </button>
  );
}
