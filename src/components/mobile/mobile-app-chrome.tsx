"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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
  buildAppChromeNavItems,
  resolveAppChromeHref,
  resolvePrimaryAppChromeRouteKey,
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
  contentScrollMode?: "document" | "contained";
  floatingLayer?: ReactNode;
  hrefs?: AppChromeHrefOverrides;
  leading?: ReactNode;
  modalLayer?: ReactNode;
  modalOpen?: boolean;
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

const MODAL_BACKGROUND_INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getItemClass(active: boolean) {
  return `${styles.navItem} ${active ? styles.navItemActive : ""}`.trim();
}

function getDesktopItemClass(active: boolean) {
  return `${styles.desktopNavItem} ${active ? styles.desktopNavItemActive : ""}`.trim();
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function useModalBackgroundInteractiveSuppression(modalOpen: boolean) {
  useLayoutEffect(() => {
    if (!modalOpen) return;

    const backgroundRoots = Array.from(
      document.querySelectorAll<HTMLElement>("[data-app-chrome-main], [data-app-chrome-floating-layer]"),
    );
    const touchedElements = new Map<HTMLElement, { ariaHidden: string | null; inert: boolean }>();

    for (const root of backgroundRoots) {
      const interactiveElements = root.querySelectorAll<HTMLElement>(MODAL_BACKGROUND_INTERACTIVE_SELECTOR);

      for (const element of interactiveElements) {
        if (element.closest('[role="dialog"][aria-modal="true"]')) continue;
        if (!touchedElements.has(element)) {
          touchedElements.set(element, {
            ariaHidden: element.getAttribute("aria-hidden"),
            inert: element.hasAttribute("inert"),
          });
        }
        element.setAttribute("aria-hidden", "true");
        element.setAttribute("inert", "");
      }
    }

    return () => {
      for (const [element, previous] of touchedElements) {
        if (!element.isConnected) continue;
        if (previous.ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", previous.ariaHidden);
        }
        if (previous.inert) {
          element.setAttribute("inert", "");
        } else {
          element.removeAttribute("inert");
        }
      }
    };
  }, [modalOpen]);
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
  const primaryActiveNav = resolvePrimaryAppChromeRouteKey(activeNav);
  const modalOpen = Boolean(chrome.modalOpen);
  const desktopChromeActive = useMediaQuery("(min-width: 1024px)");
  const toolbarDevActionVisible = useMediaQuery("(min-width: 521px)");
  const desktopChromeVisible = desktopChromeActive === true;
  const mobileChromeVisible = desktopChromeActive === false;
  const resolvedMetadata = resolveMobileAppChromeMetadata({ pathname, activeNav, t, locale });
  const hrefOverrides = chrome.hrefs;
  const navItems = useMemo(() => buildAppChromeNavItems(t, hrefOverrides), [hrefOverrides, t]);
  const activeHref = primaryActiveNav ? resolveAppChromeHref(primaryActiveNav, hrefOverrides) : null;
  const prefetchTargets = useMemo(() => {
    const targets = navItems.map((item) => (item.href === activeHref ? null : item.href));

    return [...new Set(targets.filter((target): target is string => typeof target === "string" && target.startsWith("/")))];
  }, [activeHref, navItems]);
  const desktopChromeSuppressed = modalOpen;
  const mobileChromeSuppressed = modalOpen;
  const floatingLayerSuppressed = modalOpen;
  const toolbarTitle = chrome.title ?? resolvedMetadata?.title;
  const toolbarAction = chrome.toolbarAction ?? resolvedMetadata?.toolbarAction ?? "none";
  const narrowToolbarLayout = chrome.status && chrome.status.priority !== "supplemental" ? "wrap-actions" : undefined;
  const toolbarStatus = chrome.status ? (
    <DashboardToolbarStatus
      className={chrome.status.priority === "supplemental" ? styles.toolbarSupplementalStatus : undefined}
      tone={chrome.status.tone}
    >
      {chrome.status.label}
    </DashboardToolbarStatus>
  ) : null;
  const desktopRailMarketStatus = chrome.status ? (
    <DashboardToolbarStatus className={styles.desktopRailStatusPill} tone={chrome.status.tone}>
      {chrome.status.label}
    </DashboardToolbarStatus>
  ) : (
    <span className={`pill neutral ${styles.desktopRailStatusPill}`}>{t.mobileChrome.marketStatusPending}</span>
  );
  const toolbarActions = (
    <>
      {toolbarAction === "dev-mode" && toolbarDevActionVisible === true ? (
        <span className={styles.toolbarDevAction}>
          <DevModeToggle />
        </span>
      ) : null}
      {mobileChromeVisible ? (
        <span className={styles.toolbarLanguageAction}>
          <LanguageSwitchControl testId="dashboard-header-language-switch" variant="topbar" />
        </span>
      ) : null}
    </>
  );
  const bottomNavStyle = useMemo<CSSProperties>(
    () => ({ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }),
    [navItems.length],
  );

  useModalBackgroundInteractiveSuppression(modalOpen);

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
    const active = item.id === primaryActiveNav;
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
        aria-hidden={mobileChromeSuppressed ? true : undefined}
        inert={mobileChromeSuppressed ? true : undefined}
        tabIndex={mobileChromeSuppressed ? -1 : undefined}
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
    const active = item.id === primaryActiveNav;
    const pending = isNavigatingTo(item.href);

    return (
      <Link
        key={item.id}
        href={item.href}
        prefetch
        className={`${getDesktopItemClass(active)} ${pending ? styles.desktopNavItemPending : ""}`.trim()}
        aria-hidden={desktopChromeSuppressed ? true : undefined}
        aria-busy={pending || undefined}
        aria-current={active ? "page" : undefined}
        data-navigation-pending={pending ? "true" : "false"}
        inert={desktopChromeSuppressed ? true : undefined}
        tabIndex={desktopChromeSuppressed ? -1 : undefined}
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
      data-mobile-content-scroll={chrome.contentScrollMode ?? "document"}
      data-mobile-toolbar-layout={narrowToolbarLayout ?? "single-row"}
      data-app-chrome-root
    >
      {desktopChromeVisible ? (
        <aside
          className={styles.desktopRail}
          aria-label={t.mobileChrome.desktopNavigation}
          aria-hidden={desktopChromeSuppressed ? true : undefined}
          inert={desktopChromeSuppressed ? true : undefined}
        >
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

          <div className={styles.desktopRailMetaGroup} aria-label={t.mobileChrome.desktopMetadata}>
            <section className={styles.desktopRailMeta} aria-label={t.mobileChrome.currentScreen}>
              <span className={styles.desktopRailMetaLabel}>{t.mobileChrome.currentScreen}</span>
              <strong className={styles.desktopRailScreenName}>{toolbarTitle}</strong>
            </section>

            <section className={styles.desktopRailMeta} aria-label={t.mobileChrome.marketStatus}>
              <span className={styles.desktopRailMetaLabel}>{t.mobileChrome.marketStatus}</span>
              {desktopRailMarketStatus}
            </section>

            <section className={styles.desktopRailMeta} aria-label={t.common.languageSwitcher}>
              <span className={styles.desktopRailMetaLabel}>{t.common.languageSwitcher}</span>
              <LanguageSwitchControl testId="dashboard-desktop-rail-language-switch" />
            </section>
          </div>

          <div className={styles.desktopRailStatus} aria-label={t.mobileChrome.releaseVersion}>
            <MobileAppChromeDesktopRailFooter />
          </div>
        </aside>
      ) : null}

      <header
        className={`${styles.headerFrame} topbar`}
        data-app-chrome-topbar="fixed"
        aria-hidden={modalOpen ? true : undefined}
        inert={modalOpen ? true : undefined}
      >
        <div className={styles.headerInner}>
          <DashboardToolbar
            actions={toolbarActions}
            leading={chrome.leading}
            narrowLayout={narrowToolbarLayout}
            status={toolbarStatus}
            subtitle={chrome.subtitle}
            subtitleAriaLabel={chrome.subtitleAriaLabel}
            title={toolbarTitle}
          />
        </div>
      </header>

      <main
        className={styles.main}
        aria-hidden={modalOpen ? true : undefined}
        data-app-chrome-main
        inert={modalOpen ? true : undefined}
      >
        {children}
      </main>

      {mobileChromeVisible ? (
        <div
          className={styles.bottomNavFrame}
          data-app-chrome-bottom-nav-frame
          aria-hidden={mobileChromeSuppressed ? true : undefined}
          inert={mobileChromeSuppressed ? true : undefined}
        >
          <nav
            className={styles.bottomNav}
            style={bottomNavStyle}
            aria-label={t.mobileChrome.primaryNavigation}
            aria-hidden={mobileChromeSuppressed ? true : undefined}
            data-app-chrome-bottom-nav
            inert={mobileChromeSuppressed ? true : undefined}
          >
            {navItems.map(renderNavItem)}
          </nav>
        </div>
      ) : null}
      {chrome.floatingLayer ? (
        <div
          aria-hidden={floatingLayerSuppressed ? true : undefined}
          data-app-chrome-floating-layer
          inert={floatingLayerSuppressed ? true : undefined}
        >
          {chrome.floatingLayer}
        </div>
      ) : null}
      {chrome.modalLayer}
    </div>
  );
}
