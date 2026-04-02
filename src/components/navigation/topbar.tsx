"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SearchPicker } from "@/components/ui/search-picker";
import { useAppState } from "@/components/providers/app-state-provider";
import type { SearchSuggestionDto } from "@/types/trading-api";

type TopbarProps = {
  currentPath: string;
  title: string;
  eyebrow: string;
  suggestions: SearchSuggestionDto[];
  onToggleMobileNav: () => void;
};

export function Topbar({ currentPath, title, eyebrow, suggestions, onToggleMobileNav }: TopbarProps) {
  const { locale, notificationsOn, setLocale, setNotificationsOn, t } = useAppState();
  const routeLabel = currentPath.replace("/", "") || "dashboard";

  return (
    <header className="glass topbar">
      <div className="topbar-main">
        <div className="topbar-brand">
          <div className="topbar-brand-mark">KAI</div>
          <div>
            <div className="topbar-brand-title">Sovereign Desk</div>
            <div className="topbar-brand-subtitle">Trading workstation shell</div>
          </div>
        </div>

        <div className="topbar-copy">
          <div className="topbar-page-row">
            <p className="topbar-page">{routeLabel}</p>
            <span className="topbar-separator" />
            <p className="eyebrow">{eyebrow}</p>
          </div>
          <h1>{title}</h1>
          <p className="topbar-summary">Clean desk shell with faster scanability for live market surfaces.</p>
        </div>

        <SearchPicker suggestions={suggestions} />
      </div>

      <Button className="mobile-menu-button" variant="glass" onClick={onToggleMobileNav} aria-label="Open navigation">
        NAV
      </Button>

      <div className="topbar-actions">
        <Link href="/search" className="topbar-link" aria-label="Go to Search">
          <span className="topbar-link-icon">SR</span>
          <span>Search Workspace</span>
        </Link>

        <div className="locale-switch" role="group" aria-label="Locale switcher">
          <Button className={locale === "en" ? "locale-chip active" : "locale-chip"} variant="glass" onClick={() => setLocale("en")}>
            EN
          </Button>
          <Button className={locale === "ko" ? "locale-chip active" : "locale-chip"} variant="glass" onClick={() => setLocale("ko")}>
            KO
          </Button>
        </div>

        <Button
          className={notificationsOn ? "icon-pill" : "icon-pill muted-toggle"}
          variant="pill"
          aria-pressed={notificationsOn}
          onClick={() => setNotificationsOn(!notificationsOn)}
        >
          {notificationsOn ? "Feed On" : "Feed Off"}
        </Button>

        <div className="profile-pill">
          <span className="status-dot" />
          {t.common.alphaDesk}
        </div>
      </div>
    </header>
  );
}
