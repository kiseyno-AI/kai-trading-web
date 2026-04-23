import type { Locale } from "@/types/trading-api";

export function getNumberLocale(locale: Locale) {
  return locale === "ko" ? "ko-KR" : "en-US";
}
