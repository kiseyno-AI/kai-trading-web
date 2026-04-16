"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RELEASE_DISPLAY_LABEL, RELEASE_VERSION_LABEL } from "@/lib/release-version";

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

function getDesktopItemClass(active: boolean) {
  return `${styles.desktopNavItem} ${active ? styles.desktopNavItemActive : ""}`.trim();
}

export function MobileAppChrome({
  activeNav,
  header,
  children,
  mySymbolsHref = "/dashboard#tracked-symbols",
  searchHref = "/search",
}: MobileAppChromeProps) {
  const router = useRouter();

  return (
    <div className={styles.surface}>
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />

      <aside className={styles.desktopRail} aria-label="Desktop navigation">
        <div className={styles.desktopBrand}>
          <div className={styles.desktopBrandMark}>KAI</div>
          <div>
            <strong>KAI Trading</strong>
            <span>Market Dashboard</span>
          </div>
        </div>

        <nav className={styles.desktopNav} aria-label="Primary desktop">
          <Link href="/dashboard" className={getDesktopItemClass(activeNav === "dashboard")}>
            <DashboardIcon />
            <span>Dashboard</span>
          </Link>
          <Link href={searchHref} className={getDesktopItemClass(activeNav === "search")}>
            <SearchIcon />
            <span>Search</span>
          </Link>
          <Link href="/dashboard#dashboard-freshness" className={getDesktopItemClass(false)}>
            <span className={styles.desktopNavGlyph}>MS</span>
            <span>Market Status</span>
          </Link>
          <Link href={mySymbolsHref} className={getDesktopItemClass(activeNav === "symbols")}>
            <SymbolsIcon />
            <span>My Symbols</span>
          </Link>
        </nav>

        <div className={styles.desktopRailStatus} aria-label="Release version">
          <span className={styles.releaseKicker}>Release</span>
          <strong className={styles.releaseValue}>{RELEASE_VERSION_LABEL}</strong>
          <div className={styles.releaseRule} aria-hidden="true" />
        </div>
      </aside>

      <header className={`${styles.headerFrame} topbar`}>
        <div className={styles.headerInner}>{header}</div>
      </header>

      <main className={styles.main}>{children}</main>

      <div className={styles.bottomNavFrame}>
        <div className={styles.mobileReleaseBadge} aria-label="Release version">
          {RELEASE_DISPLAY_LABEL}
        </div>
        <nav
          className={styles.bottomNav}
          aria-label="Primary"
          onPointerDown={() => {
            if (activeNav !== "dashboard") {
              router.prefetch("/dashboard");
            }
            if (activeNav !== "search") {
              router.prefetch(searchHref);
            }
          }}
        >
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
