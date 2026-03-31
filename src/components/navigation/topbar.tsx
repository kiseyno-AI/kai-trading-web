"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SearchPicker } from "@/components/ui/search-picker";
import { useAppState } from "@/components/providers/app-state-provider";
import type { SearchSuggestionDto } from "@/types/trading-api";

type TopbarProps = {
  title: string;
  eyebrow: string;
  titleClassName?: string;
  suggestions: SearchSuggestionDto[];
  onToggleMobileNav: () => void;
};

export function Topbar({ title, eyebrow, titleClassName, suggestions, onToggleMobileNav }: TopbarProps) {
  const { locale, notificationsOn, setLocale, setNotificationsOn, t } = useAppState();

  return (
    <header className="glass topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className={titleClassName}>{title}</h1>
      </div>

      <Button className="mobile-menu-button" variant="glass" onClick={onToggleMobileNav} aria-label="Open navigation">
        ☰
      </Button>

      <div className="topbar-actions">
        <Link href="/search" className="topbar-link" aria-label="Go to Search">
          <span className="topbar-link-icon">⌕</span>
          <span>Search</span>
        </Link>

        <SearchPicker suggestions={suggestions} />

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
          {notificationsOn ? t.common.notificationsOn : t.common.notificationsOff}
        </Button>

        <div className="profile-pill">
          <span className="status-dot" />
          {t.common.alphaDesk}
        </div>
      </div>
    </header>
  );
}
