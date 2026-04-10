"use client";

import { useAppState } from "@/components/providers/app-state-provider";

import styles from "./dev-mode-toggle.module.css";

export function DevModeToggle() {
  const { devMode, setDevMode } = useAppState();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${devMode ? styles.active : ""}`.trim()}
      aria-pressed={devMode}
      onClick={() => setDevMode(!devMode)}
    >
      {devMode ? "Tags On" : "Tags Off"}
    </button>
  );
}
