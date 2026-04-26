"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAppState } from "@/components/providers/app-state-provider";
import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import { warmMobileToolbarViewData } from "@/lib/mobile-toolbar-data";
import { RELEASE_VERSION_LABEL } from "@/lib/release-version";
import type { Locale } from "@/types/trading-api";

import styles from "./mobile-app-chrome.module.css";

type MobileNavKey = "dashboard" | "search" | "symbols";

type MobileAppChromeProps = {
  activeNav: MobileNavKey;
  header: ReactNode;
  children: ReactNode;
  mySymbolsHref?: string;
  searchHref?: string;
};

const DASHBOARD_HREF = "/dashboard";
const localeOptions = ["en", "ko"] as const satisfies readonly Locale[];

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

function getLocaleButtonClass(active: boolean) {
  return `${styles.localeButton} ${active ? styles.localeButtonActive : ""}`.trim();
}

export function MobileAppChrome({
  activeNav,
  header,
  children,
  mySymbolsHref = "/my-symbols",
  searchHref = "/search",
}: MobileAppChromeProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useAppState();
  const { beginNavigation, isNavigatingTo } = useNavigationLoading();
  const releaseDisplayLabel = `${t.mobileChrome.release} ${RELEASE_VERSION_LABEL}`;
  const prefetchTargets = useMemo(() => {
    const targets = [
      activeNav === "dashboard" ? null : DASHBOARD_HREF,
      activeNav === "search" ? null : searchHref,
      activeNav === "symbols" ? null : mySymbolsHref,
    ];

    return [...new Set(targets.filter((target): target is string => typeof target === "string" && target.startsWith("/")))];
  }, [activeNav, mySymbolsHref, searchHref]);

  useEffect(() => {
    void warmMobileToolbarViewData(activeNav);
  }, [activeNav]);

  useEffect(() => {
    // Warm the sibling full-screen routes immediately so the first toolbar tap
    // does not wait on viewport-based Link prefetch to finish.
    for (const target of prefetchTargets) {
      void router.prefetch(target);
    }
  }, [prefetchTargets, router]);

  const renderLocaleSwitch = (className: string) => (
    <div className={className} role="group" aria-label={t.common.languageSwitcher}>
      {localeOptions.map((option) => (
        <button
          key={option}
          type="button"
          className={getLocaleButtonClass(locale === option)}
          aria-pressed={locale === option}
          aria-label={option === "en" ? t.common.languageEnglish : t.common.languageKorean}
          onClick={() => setLocale(option)}
        >
          {t.languages[option].short}
        </button>
      ))}
    </div>
  );

  const renderNavItem = (href: string, active: boolean, label: string, icon: ReactNode) => {
    const pending = isNavigatingTo(href);

    return (
      <Link
        href={href}
        prefetch
        className={`${getItemClass(active)} ${pending ? styles.navItemPending : ""}`.trim()}
        aria-busy={pending || undefined}
        data-navigation-pending={pending ? "true" : "false"}
        onClick={() => beginNavigation(href)}
      >
        {icon}
        <span className={styles.navLabel}>{label}</span>
      </Link>
    );
  };

  const renderDesktopNavItem = (href: string, active: boolean, label: string, icon: ReactNode) => {
    const pending = isNavigatingTo(href);

    return (
      <Link
        href={href}
        prefetch
        className={`${getDesktopItemClass(active)} ${pending ? styles.desktopNavItemPending : ""}`.trim()}
        aria-busy={pending || undefined}
        data-navigation-pending={pending ? "true" : "false"}
        onClick={() => beginNavigation(href)}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className={styles.surface}>
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />

      <aside className={styles.desktopRail} aria-label={t.mobileChrome.desktopNavigation}>
        <div className={styles.desktopBrand}>
          <div className={styles.desktopBrandMark}>KAI</div>
          <div>
            <strong>{t.mobileChrome.brandTitle}</strong>
            <span>{t.mobileChrome.brandSubtitle}</span>
          </div>
        </div>

        <nav className={styles.desktopNav} aria-label={t.mobileChrome.primaryDesktopNavigation}>
          {renderDesktopNavItem(DASHBOARD_HREF, activeNav === "dashboard", t.mobileChrome.dashboard, <DashboardIcon />)}
          {renderDesktopNavItem(searchHref, activeNav === "search", t.mobileChrome.search, <SearchIcon />)}
        </nav>

        <div className={styles.desktopRailStatus} aria-label={t.mobileChrome.releaseVersion}>
          <span className={styles.releaseKicker}>{t.mobileChrome.release}</span>
          <strong className={styles.releaseValue}>{RELEASE_VERSION_LABEL}</strong>
          <div className={styles.releaseRule} aria-hidden="true" />
          {renderLocaleSwitch(`${styles.localeSwitch} ${styles.desktopLocaleSwitch}`)}
        </div>
      </aside>

      <header className={`${styles.headerFrame} topbar`}>
        <div className={styles.headerInner}>{header}</div>
      </header>

      <main className={styles.main}>{children}</main>

      <div className={styles.bottomNavFrame}>
        <div className={styles.mobileMetaRow}>
          <div className={styles.mobileReleaseBadge} aria-label={t.mobileChrome.releaseVersion}>
            {releaseDisplayLabel}
          </div>
          {renderLocaleSwitch(`${styles.localeSwitch} ${styles.mobileLocaleSwitch}`)}
        </div>
        <nav className={styles.bottomNav} aria-label={t.mobileChrome.primaryNavigation}>
          {renderNavItem(DASHBOARD_HREF, activeNav === "dashboard", t.mobileChrome.dashboard, <DashboardIcon />)}
          {renderNavItem(searchHref, activeNav === "search", t.mobileChrome.search, <SearchIcon />)}
          {renderNavItem(mySymbolsHref, activeNav === "symbols", t.mobileChrome.mySymbols, <SymbolsIcon />)}
        </nav>
      </div>
    </div>
  );
}
