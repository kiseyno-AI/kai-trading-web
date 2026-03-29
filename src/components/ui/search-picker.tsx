"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { SearchSuggestion } from "@/data/trading-dashboard";
import { Button } from "@/components/ui/button";

type SearchPickerProps = {
  suggestions: SearchSuggestion[];
};

export function SearchPicker({ suggestions }: SearchPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isOpenShortcut) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return suggestions;
    return suggestions.filter(
      (item) => item.label.toLowerCase().includes(normalized) || item.type.toLowerCase().includes(normalized),
    );
  }, [query, suggestions]);

  return (
    <div className="search-wrap">
      <Button
        className="search-button"
        variant="glass"
        aria-expanded={open}
        aria-controls="searchMenu"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{query ? query : "Search markets, bots, signals"}</span>
        <kbd>⌘K</kbd>
      </Button>

      <div id="searchMenu" className={open ? "search-menu" : "search-menu hidden"}>
        <label className="search-input-wrap">
          <span>Quick find</span>
          <input
            type="text"
            placeholder="BTC/USDT, Delta Bot, momentum signal..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus={open}
          />
        </label>
        <div className="search-suggestions">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              className="suggestion"
              onClick={() => {
                setQuery(suggestion.label);
                setOpen(false);
                router.push(suggestion.route);
              }}
            >
              <span>{suggestion.label}</span>
              <em>{suggestion.type}</em>
            </button>
          ))}
          {filteredSuggestions.length === 0 ? <div className="suggestion empty">No matches found</div> : null}
        </div>
      </div>
    </div>
  );
}
