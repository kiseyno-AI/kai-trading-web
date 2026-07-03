import type { MessageTree } from "@/i18n/messages";
import type { NavItemDto, SearchSuggestionDto } from "@/types/trading-api";

export const APP_SHELL_ROUTE_KEYS = ["dashboard", "search", "portfolio", "calendar", "markets", "bots"] as const;
export const FULL_PAGE_CHROME_ROUTE_KEYS = [
  "dashboard",
  "search",
  "calendar",
  "portfolio",
  "symbols",
  "markets",
  "bots",
] as const;
export const MARKETS_ROUTE_CHROME_ROUTE_KEYS = FULL_PAGE_CHROME_ROUTE_KEYS;

export type AppChromeRouteKey = (typeof APP_SHELL_ROUTE_KEYS)[number] | "symbols";
export type FullPageChromeRouteKey = (typeof FULL_PAGE_CHROME_ROUTE_KEYS)[number];

export type AppChromeHrefOverrides = Partial<Record<AppChromeRouteKey, string>>;

type NavigationItemKey = keyof MessageTree["navigation"]["items"];
type SearchSuggestionKey = keyof MessageTree["navigation"]["searchSuggestions"];
type MobileChromeLabelKey = keyof Pick<
  MessageTree["mobileChrome"],
  "assets" | "calendar" | "dashboard" | "markets" | "mySymbols" | "search"
>;

type AppChromeRouteDescriptor = {
  defaultHref: string;
  iconId: string;
  key: AppChromeRouteKey;
  mobileChromeLabelKey: MobileChromeLabelKey;
  navigationItemKey?: NavigationItemKey;
  searchSuggestionKey?: SearchSuggestionKey;
};

export const APP_CHROME_ROUTE_BY_KEY: Record<AppChromeRouteKey, AppChromeRouteDescriptor> = {
  dashboard: {
    key: "dashboard",
    defaultHref: "/dashboard",
    iconId: "dashboard",
    mobileChromeLabelKey: "dashboard",
    navigationItemKey: "dashboard",
    searchSuggestionKey: "dashboard",
  },
  search: {
    key: "search",
    defaultHref: "/search",
    iconId: "search",
    mobileChromeLabelKey: "search",
    navigationItemKey: "search",
    searchSuggestionKey: "search",
  },
  portfolio: {
    key: "portfolio",
    defaultHref: "/portfolio",
    iconId: "portfolio",
    mobileChromeLabelKey: "assets",
    navigationItemKey: "portfolio",
    searchSuggestionKey: "portfolio",
  },
  calendar: {
    key: "calendar",
    defaultHref: "/calendar",
    iconId: "calendar",
    mobileChromeLabelKey: "calendar",
    navigationItemKey: "calendar",
    searchSuggestionKey: "calendar",
  },
  symbols: {
    key: "symbols",
    defaultHref: "/my-symbols",
    iconId: "symbols",
    mobileChromeLabelKey: "mySymbols",
  },
  markets: {
    key: "markets",
    defaultHref: "/markets",
    iconId: "markets",
    mobileChromeLabelKey: "markets",
    navigationItemKey: "markets",
    searchSuggestionKey: "markets",
  },
  bots: {
    key: "bots",
    defaultHref: "/bots",
    iconId: "bots",
    mobileChromeLabelKey: "dashboard",
    navigationItemKey: "bots",
    searchSuggestionKey: "bots",
  },
};

export const APP_CHROME_ROUTES = Object.values(APP_CHROME_ROUTE_BY_KEY);

export function getAppChromeRoute(key: AppChromeRouteKey) {
  return APP_CHROME_ROUTE_BY_KEY[key];
}

export function resolveAppChromeHref(key: AppChromeRouteKey, hrefOverrides: AppChromeHrefOverrides = {}) {
  return hrefOverrides[key] ?? getAppChromeRoute(key).defaultHref;
}

export function buildAppChromeNavItems(
  t: MessageTree,
  routeKeys: readonly AppChromeRouteKey[] = APP_SHELL_ROUTE_KEYS,
  hrefOverrides: AppChromeHrefOverrides = {},
): NavItemDto[] {
  return routeKeys.map((routeKey) => {
    const route = getAppChromeRoute(routeKey);
    const navigationCopy = route.navigationItemKey ? t.navigation.items[route.navigationItemKey] : null;

    return {
      id: route.key,
      label: navigationCopy?.label ?? t.mobileChrome[route.mobileChromeLabelKey],
      icon: route.iconId,
      href: resolveAppChromeHref(route.key, hrefOverrides),
      description: navigationCopy?.description ?? t.mySymbols.brandMeta,
    };
  });
}

export function buildAppChromeSearchSuggestions(
  t: MessageTree,
  routeKeys: readonly AppChromeRouteKey[] = APP_SHELL_ROUTE_KEYS,
  hrefOverrides: AppChromeHrefOverrides = {},
): SearchSuggestionDto[] {
  return routeKeys.flatMap((routeKey) => {
    const route = getAppChromeRoute(routeKey);

    if (!route.searchSuggestionKey) return [];

    return {
      id: route.key,
      label: t.navigation.searchSuggestions[route.searchSuggestionKey],
      type: "route",
      route: resolveAppChromeHref(route.key, hrefOverrides),
    };
  });
}
