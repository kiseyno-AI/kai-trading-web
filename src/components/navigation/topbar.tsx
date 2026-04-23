"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SearchPicker } from "@/components/ui/search-picker";
import { useAppState } from "@/components/providers/app-state-provider";
import { resolveRouteMessageKey } from "@/i18n/messages";
import type { SearchSuggestionDto } from "@/types/trading-api";

type TopbarProps = {
  currentPath: string;
  title: string;
  eyebrow: string;
  compactMobileChrome?: boolean;
  suggestions: SearchSuggestionDto[];
  onToggleMobileNav: () => void;
};

export function Topbar({
  currentPath,
  title,
  eyebrow,
  compactMobileChrome = false,
  suggestions,
  onToggleMobileNav,
}: TopbarProps) {
  const { devMode, locale, notificationsOn, setDevMode, setLocale, setNotificationsOn, t } = useAppState();
  const routeLabel = t.routes[resolveRouteMessageKey(currentPath)].label;

  return (
    <header className={`glass topbar ${compactMobileChrome ? "topbar-compact-mobile" : ""}`}>
      <div className="topbar-main">
        <div className="topbar-brand">
          <div className="topbar-brand-mark">KAI</div>
          <div>
            <div className="topbar-brand-title">{t.navigation.brandTitle}</div>
            <div className="topbar-brand-subtitle">{t.navigation.brandSubtitle}</div>
          </div>
        </div>

        <div className="topbar-copy">
          <div className="topbar-page-row">
            <p className="topbar-page">{routeLabel}</p>
            <span className="topbar-separator" />
            <p className="eyebrow">{eyebrow}</p>
          </div>
          <h1>{title}</h1>
          <p className="topbar-summary">{t.navigation.topbarSummary}</p>
        </div>

        <SearchPicker suggestions={suggestions} />
      </div>

      <Button className="mobile-menu-button" variant="glass" onClick={onToggleMobileNav} aria-label={t.navigation.openNavigation}>
        {t.navigation.mobileMenuText}
      </Button>

      <div className="topbar-actions">
        <Link href="/search" className="topbar-link" aria-label={t.navigation.goToSearch}>
          <span className="topbar-link-icon">SR</span>
          <span>{t.navigation.searchWorkspace}</span>
        </Link>

        <div className="locale-switch" role="group" aria-label={t.common.languageSwitcher}>
          <Button
            className={locale === "en" ? "locale-chip active" : "locale-chip"}
            variant="glass"
            aria-label={t.common.languageEnglish}
            onClick={() => setLocale("en")}
          >
            {t.languages.en.short}
          </Button>
          <Button
            className={locale === "ko" ? "locale-chip active" : "locale-chip"}
            variant="glass"
            aria-label={t.common.languageKorean}
            onClick={() => setLocale("ko")}
          >
            {t.languages.ko.short}
          </Button>
        </div>

        <Button
          className={notificationsOn ? "icon-pill" : "icon-pill muted-toggle"}
          variant="pill"
          aria-pressed={notificationsOn}
          onClick={() => setNotificationsOn(!notificationsOn)}
        >
          {notificationsOn ? t.common.feedOn : t.common.feedOff}
        </Button>

        <Button
          className={devMode ? "icon-pill" : "icon-pill muted-toggle"}
          variant="pill"
          aria-pressed={devMode}
          onClick={() => setDevMode(!devMode)}
        >
          {devMode ? t.common.tagsOn : t.common.tagsOff}
        </Button>

        <div className="profile-pill">
          <span className="status-dot" />
          {t.common.alphaDesk}
        </div>
      </div>
    </header>
  );
}
