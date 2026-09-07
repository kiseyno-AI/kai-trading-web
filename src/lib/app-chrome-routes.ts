import type { MessageTree } from "@/i18n/messages";
import type { NavItemDto } from "@/types/trading-api";

export const PRIMARY_APP_CHROME_ROUTE_KEYS = ["dashboard", "search", "calendar", "portfolio"] as const;

export type AppChromeRouteKey = (typeof PRIMARY_APP_CHROME_ROUTE_KEYS)[number] | "symbols" | "markets";
export type PrimaryAppChromeRouteKey = (typeof PRIMARY_APP_CHROME_ROUTE_KEYS)[number];
export type AppChromeHrefOverrides = Partial<Record<AppChromeRouteKey, string>>;

type NavigationItemKey = keyof MessageTree["navigation"]["items"];
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
};

export const APP_CHROME_ROUTE_BY_KEY: Record<AppChromeRouteKey, AppChromeRouteDescriptor> = {
  dashboard: {
    key: "dashboard",
    defaultHref: "/dashboard",
    iconId: "dashboard",
    mobileChromeLabelKey: "dashboard",
    navigationItemKey: "dashboard",
  },
  search: {
    key: "search",
    defaultHref: "/search",
    iconId: "search",
    mobileChromeLabelKey: "search",
    navigationItemKey: "search",
  },
  portfolio: {
    key: "portfolio",
    defaultHref: "/portfolio",
    iconId: "portfolio",
    mobileChromeLabelKey: "assets",
    navigationItemKey: "portfolio",
  },
  calendar: {
    key: "calendar",
    defaultHref: "/calendar",
    iconId: "calendar",
    mobileChromeLabelKey: "calendar",
    navigationItemKey: "calendar",
  },
  symbols: {
    key: "symbols",
    defaultHref: "/my-symbols",
    iconId: "symbols",
    mobileChromeLabelKey: "mySymbols",
  },
  markets: {
    key: "markets",
    defaultHref: "/markets/factors",
    iconId: "markets",
    mobileChromeLabelKey: "markets",
    navigationItemKey: "markets",
  },
};

function getAppChromeRoute(key: AppChromeRouteKey) {
  return APP_CHROME_ROUTE_BY_KEY[key];
}

export function resolvePrimaryAppChromeRouteKey(
  key: AppChromeRouteKey | null | undefined,
): PrimaryAppChromeRouteKey | null {
  if (!key) return null;
  if (key === "symbols" || key === "markets") return "search";
  return key;
}

export function resolveAppChromeHref(key: AppChromeRouteKey, hrefOverrides: AppChromeHrefOverrides = {}) {
  return hrefOverrides[key] ?? getAppChromeRoute(key).defaultHref;
}

export function buildAppChromeNavItems(
  t: MessageTree,
  hrefOverrides: AppChromeHrefOverrides = {},
): NavItemDto[] {
  return PRIMARY_APP_CHROME_ROUTE_KEYS.map((routeKey) => {
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
