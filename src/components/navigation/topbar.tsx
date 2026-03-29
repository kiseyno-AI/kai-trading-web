"use client";

import { useState } from "react";

import type { SearchSuggestion } from "@/data/trading-dashboard";
import { Button } from "@/components/ui/button";
import { SearchPicker } from "@/components/ui/search-picker";

type TopbarProps = {
  title: string;
  eyebrow: string;
  suggestions: SearchSuggestion[];
  onToggleMobileNav: () => void;
};

export function Topbar({ title, eyebrow, suggestions, onToggleMobileNav }: TopbarProps) {
  const [notificationsOn, setNotificationsOn] = useState(true);

  return (
    <header className="glass topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>

      <Button className="mobile-menu-button" variant="glass" onClick={onToggleMobileNav} aria-label="Open navigation">
        ☰
      </Button>

      <div className="topbar-actions">
        <SearchPicker suggestions={suggestions} />

        <Button
          className={notificationsOn ? "icon-pill" : "icon-pill muted-toggle"}
          variant="pill"
          aria-pressed={notificationsOn}
          onClick={() => setNotificationsOn((value) => !value)}
        >
          {notificationsOn ? "Notifications On" : "Notifications Off"}
        </Button>

        <div className="profile-pill">
          <span className="status-dot" />
          Alpha Desk
        </div>
      </div>
    </header>
  );
}
