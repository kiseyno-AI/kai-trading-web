import type { MessageTree } from "@/i18n/messages";
import { getSearchPageCopy } from "@/i18n/search-page-copy";
import type { FullPageChromeRouteKey } from "@/lib/app-chrome-routes";
import type { Locale } from "@/types/trading-api";

type PathMatcher = (pathname: string) => boolean;

export type MobileAppChromeRouteMetadata = {
  title?: string;
  toolbarAction: "dev-mode" | "none";
};

type RoutePathMetadata = {
  match: PathMatcher;
  title: (t: MessageTree, locale: Locale) => string;
};

const DEFAULT_DASHBOARD_TOOLBAR_ACTION: MobileAppChromeRouteMetadata["toolbarAction"] = "dev-mode";
const DEFAULT_NON_DASHBOARD_TOOLBAR_ACTION: MobileAppChromeRouteMetadata["toolbarAction"] = "none";

function normalizePathname(pathname: string | null) {
  if (!pathname) return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

const PATH_BASED_TITLES: RoutePathMetadata[] = [
  {
    match: (pathname) =>
      pathname === "/dashboard/signal-decider-feedback" || pathname.startsWith("/dashboard/signal-decider-feedback/"),
    title: (t) => t.routes["signalDeciderFeedback"].title,
  },
  {
    match: (pathname) =>
      pathname === "/dashboard/decider-feedback" || pathname.startsWith("/dashboard/decider-feedback/"),
    title: (t) => t.routes["deciderFeedback"].title,
  },
  {
    match: (pathname) => {
      const normalized = pathname.replace(/\/+$/, "");
      return normalized === "/search" || normalized.endsWith("/search");
    },
    title: (_t, locale) => getSearchPageCopy(locale).hero.title,
  },
];

const NAV_BASED_TITLES: Partial<Record<FullPageChromeRouteKey, (t: MessageTree, locale: Locale) => string>> = {
  dashboard: (t) => t.routes.dashboard.title,
  search: (_t, locale) => getSearchPageCopy(locale).hero.title,
  symbols: (t) => t.mySymbols.title,
  portfolio: (t) => t.portfolio.title,
  calendar: (t) => t.routes.calendar.title,
  markets: (t) => t.markets.title,
};

const NAV_BASED_TOOLBAR_ACTIONS: Partial<Record<FullPageChromeRouteKey, MobileAppChromeRouteMetadata["toolbarAction"]>> = {
  dashboard: "dev-mode",
  search: "dev-mode",
  symbols: "dev-mode",
  portfolio: "dev-mode",
};

export function resolveMobileAppChromeMetadata({
  pathname,
  activeNav,
  t,
  locale = "en",
}: {
  pathname: string | null;
  activeNav?: FullPageChromeRouteKey | null;
  t: MessageTree;
  locale?: Locale;
}): MobileAppChromeRouteMetadata {
  const normalizedPath = normalizePathname(pathname);
  const pathMatch = PATH_BASED_TITLES.find((candidate) => candidate.match(normalizedPath));
  if (pathMatch) {
    return {
      title: pathMatch.title(t, locale),
      toolbarAction: "dev-mode",
    };
  }

  const titleResolver = activeNav ? NAV_BASED_TITLES[activeNav] : null;
  const toolbarAction = activeNav ? NAV_BASED_TOOLBAR_ACTIONS[activeNav] : null;
  if (!titleResolver) {
    return {
      toolbarAction: normalizedPath.startsWith("/dashboard") ? DEFAULT_DASHBOARD_TOOLBAR_ACTION : DEFAULT_NON_DASHBOARD_TOOLBAR_ACTION,
    };
  }

  return {
    title: titleResolver(t, locale),
    toolbarAction: toolbarAction ?? (normalizedPath.startsWith("/dashboard") ? DEFAULT_DASHBOARD_TOOLBAR_ACTION : DEFAULT_NON_DASHBOARD_TOOLBAR_ACTION),
  };
}
