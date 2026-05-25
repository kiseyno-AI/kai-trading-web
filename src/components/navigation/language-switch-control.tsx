"use client";

import { useAppState } from "@/components/providers/app-state-provider";
import { cn } from "@/lib/utils";
import type { Locale } from "@/types/trading-api";

import styles from "./language-switch-control.module.css";

type LanguageSwitchControlProps = {
  buttonTabIndex?: number;
  className?: string;
  testId?: string;
  variant?: "compact" | "topbar";
};

const localeOptions = ["en", "ko"] as const satisfies readonly Locale[];

export function LanguageSwitchControl({
  buttonTabIndex,
  className,
  testId,
  variant = "compact",
}: LanguageSwitchControlProps) {
  const { locale, setLocale, t } = useAppState();

  return (
    <div
      className={cn(styles.switch, variant === "topbar" ? styles.topbar : styles.compact, className)}
      role="group"
      aria-label={t.common.languageSwitcher}
      data-testid={testId}
    >
      {localeOptions.map((option) => (
        <button
          key={option}
          type="button"
          className={cn(
            styles.button,
            variant === "topbar" ? styles.topbarButton : styles.compactButton,
            locale === option && styles.buttonActive,
          )}
          aria-pressed={locale === option}
          aria-label={option === "en" ? t.common.languageEnglish : t.common.languageKorean}
          tabIndex={buttonTabIndex}
          onClick={() => setLocale(option)}
        >
          {t.languages[option].short}
        </button>
      ))}
    </div>
  );
}
