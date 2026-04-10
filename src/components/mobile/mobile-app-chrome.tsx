"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import styles from "./mobile-app-chrome.module.css";

type MobileNavKey = "dashboard" | "search" | "symbols";

type MobileAppChromeProps = {
  activeNav: MobileNavKey;
  header: ReactNode;
  children: ReactNode;
  mySymbolsHref?: string;
  searchHref?: string;
};

function DashboardIcon() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="18" width="7" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SymbolsIcon() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5L14.6 8.6L20.3 9.4L16.2 13.3L17.2 19L12 16.3L6.8 19L7.8 13.3L3.7 9.4L9.4 8.6L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getItemClass(active: boolean) {
  return `${styles.navItem} ${active ? styles.navItemActive : ""}`.trim();
}

export function MobileAppChrome({
  activeNav,
  header,
  children,
  mySymbolsHref = "/dashboard#tracked-symbols",
  searchHref = "/search",
}: MobileAppChromeProps) {
  return (
    <div className={styles.surface}>
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />

      <header className={`${styles.headerFrame} topbar`}>
        <div className={styles.headerInner}>{header}</div>
      </header>

      <main className={styles.main}>{children}</main>

      <div className={styles.bottomNavFrame}>
        <nav className={styles.bottomNav} aria-label="Primary">
          <Link href="/dashboard" className={getItemClass(activeNav === "dashboard")}>
            <DashboardIcon />
            <span className={styles.navLabel}>Dashboard</span>
          </Link>
          <Link href={searchHref} className={getItemClass(activeNav === "search")}>
            <SearchIcon />
            <span className={styles.navLabel}>Search</span>
          </Link>
          <Link href={mySymbolsHref} className={getItemClass(activeNav === "symbols")}>
            <SymbolsIcon />
            <span className={styles.navLabel}>My Symbols</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
