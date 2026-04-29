"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardToolbar, type DashboardToolbarProps } from "@/components/navigation/dashboard-toolbar";
import { NavGlyph } from "@/components/navigation/nav-glyph";
import { useAppState } from "@/components/providers/app-state-provider";
import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import {
  FULL_PAGE_CHROME_ROUTE_KEYS,
  buildAppChromeNavItems,
  resolveAppChromeHref,
  type AppChromeHrefOverrides,
  type FullPageChromeRouteKey,
} from "@/lib/app-chrome-routes";
import { warmMobileToolbarViewData } from "@/lib/mobile-toolbar-data";
import { RELEASE_VERSION_LABEL } from "@/lib/release-version";
import type { Locale } from "@/types/trading-api";

import styles from "./mobile-app-chrome.module.css";

type MobileAppChromeBottomChrome = {
  accessory?: ReactNode;
  meta?: ReactNode | null;
};

type MobileAppChromeDesktopRail = {
  footer?: ReactNode | null;
};

type MobileAppChromeProps = {
  activeNav: FullPageChromeRouteKey;
  topbar: DashboardToolbarProps;
  children: ReactNode;
  bottomChrome?: MobileAppChromeBottomChrome;
  desktopRail?: MobileAppChromeDesktopRail;
  floatingLayer?: ReactNode;
  hrefs?: AppChromeHrefOverrides;
};

const localeOptions = ["en", "ko"] as const satisfies readonly Locale[];
const EMPTY_HREF_OVERRIDES: AppChromeHrefOverrides = {};

function getItemClass(active: boolean) {
  return `${styles.navItem} ${active ? styles.navItemActive : ""}`.trim();
}

function getDesktopItemClass(active: boolean) {
  return `${styles.desktopNavItem} ${active ? styles.desktopNavItemActive : ""}`.trim();
}

function getLocaleButtonClass(active: boolean) {
  return `${styles.localeButton} ${active ? styles.localeButtonActive : ""}`.trim();
}

function LocaleSwitch({ className }: { className: string }) {
  const { locale, setLocale, t } = useAppState();

  return (
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
}

function MobileAppChromeMetaRow() {
  const { t } = useAppState();
  const releaseDisplayLabel = `${t.mobileChrome.release} ${RELEASE_VERSION_LABEL}`;

  return (
    <>
      <div className={styles.mobileReleaseBadge} aria-label={t.mobileChrome.releaseVersion}>
        {releaseDisplayLabel}
      </div>
      <LocaleSwitch className={`${styles.localeSwitch} ${styles.mobileLocaleSwitch}`} />
    </>
  );
}

type MobileAppChromeDesktopRailFooterProps = {
  variant?: "default" | "release";
};

export function MobileAppChromeDesktopRailFooter({ variant = "default" }: MobileAppChromeDesktopRailFooterProps) {
  const { t } = useAppState();

  return (
    <>
      <span className={styles.releaseKicker}>{t.mobileChrome.release}</span>
      <strong className={styles.releaseValue}>{RELEASE_VERSION_LABEL}</strong>
      <div className={styles.releaseRule} aria-hidden="true" />
      {variant === "default" ? <LocaleSwitch className={`${styles.localeSwitch} ${styles.desktopLocaleSwitch}`} /> : null}
    </>
  );
}

export function MobileAppChrome({
  activeNav,
  children,
  topbar,
  bottomChrome,
  desktopRail,
  floatingLayer,
  hrefs,
}: MobileAppChromeProps) {
  const router = useRouter();
  const { t } = useAppState();
  const { beginNavigation, isNavigatingTo } = useNavigationLoading();
  const hrefOverrides = hrefs ?? EMPTY_HREF_OVERRIDES;
  const navItems = useMemo(
    () => buildAppChromeNavItems(t, FULL_PAGE_CHROME_ROUTE_KEYS, hrefOverrides),
    [hrefOverrides, t],
  );
  const activeHref = resolveAppChromeHref(activeNav, hrefOverrides);
  const prefetchTargets = useMemo(() => {
    const targets = navItems.map((item) => (item.href === activeHref ? null : item.href));

    return [...new Set(targets.filter((target): target is string => typeof target === "string" && target.startsWith("/")))];
  }, [activeHref, navItems]);
  const bottomAccessory = bottomChrome?.accessory;
  const bottomMeta = bottomChrome?.meta === undefined ? <MobileAppChromeMetaRow /> : bottomChrome.meta;
  const desktopRailFooter = desktopRail?.footer === undefined ? <MobileAppChromeDesktopRailFooter /> : desktopRail.footer;

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

  const renderNavItem = (item: (typeof navItems)[number]) => {
    const active = item.id === activeNav;
    const pending = isNavigatingTo(item.href);

    return (
      <Link
        key={item.id}
        href={item.href}
        prefetch
        className={`${getItemClass(active)} ${pending ? styles.navItemPending : ""}`.trim()}
        aria-busy={pending || undefined}
        data-navigation-pending={pending ? "true" : "false"}
        onClick={() => beginNavigation(item.href)}
      >
        <span className={styles.navIcon} aria-hidden="true">
          <NavGlyph id={item.icon} />
        </span>
        <span className={styles.navLabel}>{item.label}</span>
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
          <div className={styles.desktopBrandMark}>KAI</div>
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
          <DashboardToolbar {...topbar} />
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <div className={styles.bottomNavFrame}>
        {bottomMeta ? <div className={styles.mobileMetaRow}>{bottomMeta}</div> : null}
        {bottomAccessory ? <div className={styles.bottomAccessory}>{bottomAccessory}</div> : null}
        <nav className={styles.bottomNav} aria-label={t.mobileChrome.primaryNavigation}>
          {navItems.map(renderNavItem)}
        </nav>
      </div>
      {floatingLayer}
    </div>
  );
}
