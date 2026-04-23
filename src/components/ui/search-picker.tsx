"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAppState } from "@/components/providers/app-state-provider";
import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import { Button } from "@/components/ui/button";
import { logWebDiagnostic } from "@/lib/web-diagnostics";
import type { SearchSuggestionDto } from "@/types/trading-api";

type SearchPickerProps = {
  suggestions: SearchSuggestionDto[];
};

export function SearchPicker({ suggestions }: SearchPickerProps) {
  const { t } = useAppState();
  const router = useRouter();
  const { beginNavigation } = useNavigationLoading();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isOpenShortcut) {
        event.preventDefault();
        logWebDiagnostic("interaction", "search-picker-open", {
          source: "keyboard",
        });
        setOpen(true);
      }
      if (event.key === "Escape") {
        logWebDiagnostic("interaction", "search-picker-close", {
          source: "keyboard",
        });
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return suggestions;
    return suggestions.filter((item) => {
      const typeLabel = t.common.suggestionTypes[item.type].toLowerCase();
      return (
        item.label.toLowerCase().includes(normalized) ||
        item.type.toLowerCase().includes(normalized) ||
        typeLabel.includes(normalized)
      );
    });
  }, [query, suggestions, t.common.suggestionTypes]);

  return (
    <div className="search-wrap">
      <Button
        className="search-button"
        variant="glass"
        aria-expanded={open}
        aria-controls="searchMenu"
        aria-label={t.common.searchButton}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{query ? query : t.common.searchTriggerPlaceholder}</span>
        <kbd>⌘K</kbd>
      </Button>

      <div id="searchMenu" className={open ? "search-menu" : "search-menu hidden"}>
        <label className="search-input-wrap">
          <span>{t.common.quickFind}</span>
          <input
            type="text"
            placeholder={t.common.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus={open}
          />
        </label>
        <div className="search-suggestions">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="suggestion"
              onClick={() => {
                logWebDiagnostic("interaction", "search-suggestion-select", {
                  label: suggestion.label,
                  route: suggestion.route,
                  type: suggestion.type,
                });
                setQuery(suggestion.label);
                setOpen(false);
                beginNavigation(suggestion.route);
                router.push(suggestion.route);
              }}
            >
              <span>{suggestion.label}</span>
              <em>{t.common.suggestionTypes[suggestion.type]}</em>
            </button>
          ))}
          {filteredSuggestions.length === 0 ? <div className="suggestion empty">{t.common.noMatches}</div> : null}
        </div>
      </div>
    </div>
  );
}
