import type { Locale } from "@/types/trading-api";

import enMessages from "./locales/en.json";
import koMessages from "./locales/ko.json";

export const defaultLocale: Locale = "en";
export const supportedLocales = ["en", "ko"] as const satisfies readonly Locale[];

export type MessageTree = typeof enMessages;
export type RouteMessageKey = keyof MessageTree["routes"];

export const messages: Record<Locale, MessageTree> = {
  en: enMessages,
  ko: koMessages,
};

export function resolveLocale(value: unknown): Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}

const routeMessageKeys = Object.keys(enMessages.routes) as RouteMessageKey[];

export function resolveRouteMessageKey(path: string): RouteMessageKey {
  const segment = path.split("?")[0]?.split("#")[0]?.split("/").filter(Boolean)[0] ?? "dashboard";
  return routeMessageKeys.includes(segment as RouteMessageKey) ? (segment as RouteMessageKey) : "dashboard";
}
