"use client";

import { useAppState } from "@/components/providers/app-state-provider";

import styles from "./dev-mode-toggle.module.css";

export function DevModeToggle() {
  const { devMode, setDevMode, t } = useAppState();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${devMode ? styles.active : ""}`.trim()}
      aria-pressed={devMode}
      onClick={() => setDevMode(!devMode)}
    >
      {devMode ? t.common.tagsOn : t.common.tagsOff}
    </button>
  );
}
