"use client";

import Link from "next/link";

import { LanguageSwitchControl } from "@/components/navigation/language-switch-control";
import { NavGlyph } from "@/components/navigation/app-sidebar";
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
  const { notificationsOn, setNotificationsOn, t } = useAppState();
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
          <span className="topbar-link-icon" aria-hidden="true">
            <NavGlyph id="search" />
          </span>
          <span>{t.navigation.searchWorkspace}</span>
        </Link>

        <Button
          className={notificationsOn ? "icon-pill" : "icon-pill muted-toggle"}
          variant="pill"
          aria-pressed={notificationsOn}
          onClick={() => setNotificationsOn(!notificationsOn)}
        >
          {notificationsOn ? t.common.feedOn : t.common.feedOff}
        </Button>

        <LanguageSwitchControl variant="topbar" />

        <div className="profile-pill">
          <span className="status-dot" />
          {t.common.alphaDesk}
        </div>
      </div>
    </header>
  );
}
