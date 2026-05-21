"use client";

import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";

import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import {
  DashboardToolbar,
  DashboardToolbarStatus,
  type DashboardToolbarStatusTone,
} from "@/components/navigation/dashboard-toolbar";
import { LanguageSwitchControl } from "@/components/navigation/language-switch-control";
import { NavGlyph } from "@/components/navigation/nav-glyph";
import { useAppState } from "@/components/providers/app-state-provider";
import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import {
  FULL_PAGE_CHROME_ROUTE_KEYS,
  buildAppChromeNavItems,
  resolveAppChromeHref,
  type AppChromeHrefOverrides,
  type AppChromeRouteKey,
} from "@/lib/app-chrome-routes";
import { resolveMobileAppChromeMetadata } from "@/lib/mobile-app-chrome-route-metadata";
import { warmMobileToolbarViewData } from "@/lib/mobile-toolbar-data";
import { RELEASE_VERSION_LABEL } from "@/lib/release-version";

import styles from "./mobile-app-chrome.module.css";

type MobileAppChromeStatus = {
  label: ReactNode;
  priority?: "default" | "supplemental";
  tone?: DashboardToolbarStatusTone;
};

export type MobileAppChromeRouteChrome = {
  activeNav?: AppChromeRouteKey | null;
  bottomAccessory?: ReactNode;
  floatingLayer?: ReactNode;
  hrefs?: AppChromeHrefOverrides;
  leading?: ReactNode;
  status?: MobileAppChromeStatus | null;
  subtitle?: ReactNode | null;
  subtitleAriaLabel?: string;
  title?: ReactNode;
  toolbarAction?: "dev-mode" | "none";
};

type MobileAppChromeProps = {
  chrome: MobileAppChromeRouteChrome;
  children: ReactNode;
};

const EMPTY_HREF_OVERRIDES: AppChromeHrefOverrides = {};

function getItemClass(active: boolean) {
  return `${styles.navItem} ${active ? styles.navItemActive : ""}`.trim();
}

function getDesktopItemClass(active: boolean) {
  return `${styles.desktopNavItem} ${active ? styles.desktopNavItemActive : ""}`.trim();
}

export function MobileAppChromeDesktopRailFooter() {
  const { t } = useAppState();

  return (
    <>
      <span className={styles.releaseKicker}>{t.mobileChrome.release}</span>
      <strong className={styles.releaseValue}>{RELEASE_VERSION_LABEL}</strong>
      <div className={styles.releaseRule} aria-hidden="true" />
    </>
  );
}

export function MobileAppChrome({
  children,
  chrome,
}: MobileAppChromeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useAppState();
  const { beginNavigation, isNavigatingTo } = useNavigationLoading();
  const activeNav = chrome.activeNav ?? null;
  const resolvedMetadata = resolveMobileAppChromeMetadata({ pathname, activeNav, t, locale });
  const hrefOverrides = chrome.hrefs ?? EMPTY_HREF_OVERRIDES;
  const navItems = useMemo(
    () => buildAppChromeNavItems(t, FULL_PAGE_CHROME_ROUTE_KEYS, hrefOverrides),
    [hrefOverrides, t],
  );
  const activeHref = activeNav ? resolveAppChromeHref(activeNav, hrefOverrides) : null;
  const prefetchTargets = useMemo(() => {
    const targets = navItems.map((item) => (item.href === activeHref ? null : item.href));

    return [...new Set(targets.filter((target): target is string => typeof target === "string" && target.startsWith("/")))];
  }, [activeHref, navItems]);
  const bottomAccessory = chrome.bottomAccessory;
  const bottomMeta = null;
  const desktopRailFooter = <MobileAppChromeDesktopRailFooter />;
  const toolbarTitle = chrome.title ?? resolvedMetadata?.title;
  const toolbarAction = chrome.toolbarAction ?? resolvedMetadata?.toolbarAction ?? "none";
  const toolbarStatus = chrome.status ? (
    <DashboardToolbarStatus
      className={chrome.status.priority === "supplemental" ? styles.toolbarSupplementalStatus : undefined}
      tone={chrome.status.tone}
    >
      {chrome.status.label}
    </DashboardToolbarStatus>
  ) : null;
  const toolbarActions = (
    <>
      {toolbarAction === "dev-mode" ? (
        <span className={styles.toolbarDevAction}>
          <DevModeToggle />
        </span>
      ) : null}
      <LanguageSwitchControl testId="dashboard-header-language-switch" />
    </>
  );
  const bottomNavStyle = useMemo<CSSProperties>(
    () => ({ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }),
    [navItems.length],
  );

  useEffect(() => {
    if (!activeNav) return;

    void warmMobileToolbarViewData(activeNav);
  }, [activeNav]);

  useEffect(() => {
    // Warm the sibling full-screen routes immediately so the first toolbar tap
    // does not wait on viewport-based Link prefetch to finish.
    for (const target of prefetchTargets) {
      void router.prefetch(target);
    }
  }, [prefetchTargets, router]);

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const active = item.id === activeNav;
    const pending = isNavigatingTo(item.href);

    return (
      <Link
        key={item.id}
        href={item.href}
        prefetch
        className={`${getItemClass(active)} ${pending ? styles.navItemPending : ""}`.trim()}
        aria-label={item.label}
        aria-busy={pending || undefined}
        aria-current={active ? "page" : undefined}
        data-mobile-nav-item={item.id}
        data-navigation-pending={pending ? "true" : "false"}
        title={item.label}
        onClick={() => beginNavigation(item.href)}
      >
        <span className={styles.navIcon} aria-hidden="true">
          <NavGlyph id={item.icon} />
        </span>
        <span className={styles.navLabel} data-mobile-nav-label>
          {item.label}
        </span>
      </Link>
    );
  };

  const renderDesktopNavItem = (item: (typeof navItems)[number]) => {
    const active = item.id === activeNav;
    const pending = isNavigatingTo(item.href);

    return (
      <Link
        key={item.id}
        href={item.href}
        prefetch
        className={`${getDesktopItemClass(active)} ${pending ? styles.desktopNavItemPending : ""}`.trim()}
        aria-busy={pending || undefined}
        aria-current={active ? "page" : undefined}
        data-navigation-pending={pending ? "true" : "false"}
        onClick={() => beginNavigation(item.href)}
      >
        <span className={styles.navIcon} aria-hidden="true">
          <NavGlyph id={item.icon} />
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div
      className={styles.surface}
      data-mobile-bottom-accessory={bottomAccessory ? "present" : "absent"}
      data-mobile-meta-row={bottomMeta ? "visible" : "hidden"}
    >
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />

      <aside className={styles.desktopRail} aria-label={t.mobileChrome.desktopNavigation}>
        <div className={styles.desktopBrand}>
          <div className={styles.desktopBrandMark} aria-hidden="true" />
          <div>
            <strong>{t.mobileChrome.brandTitle}</strong>
            <span>{t.mobileChrome.brandSubtitle}</span>
          </div>
        </div>

        <nav className={styles.desktopNav} aria-label={t.mobileChrome.primaryDesktopNavigation}>
          {navItems.map(renderDesktopNavItem)}
        </nav>

        {desktopRailFooter ? (
          <div className={styles.desktopRailStatus} aria-label={t.mobileChrome.releaseVersion}>
            {desktopRailFooter}
          </div>
        ) : null}
      </aside>

      <header className={`${styles.headerFrame} topbar`} data-app-chrome-topbar="fixed">
        <div className={styles.headerInner}>
          <DashboardToolbar
            actions={toolbarActions}
            leading={chrome.leading}
            status={toolbarStatus}
            subtitle={chrome.subtitle}
            subtitleAriaLabel={chrome.subtitleAriaLabel}
            title={toolbarTitle}
          />
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <div className={styles.bottomNavFrame}>
        {bottomMeta ? <div className={styles.mobileMetaRow}>{bottomMeta}</div> : null}
        {bottomAccessory ? <div className={styles.bottomAccessory}>{bottomAccessory}</div> : null}
        <nav className={styles.bottomNav} style={bottomNavStyle} aria-label={t.mobileChrome.primaryNavigation}>
          {navItems.map(renderNavItem)}
        </nav>
      </div>
      {chrome.floatingLayer}
    </div>
  );
}
