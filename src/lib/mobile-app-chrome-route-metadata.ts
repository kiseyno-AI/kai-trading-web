import type { MessageTree } from "@/i18n/messages";
import type { FullPageChromeRouteKey } from "@/lib/app-chrome-routes";

type PathMatcher = (pathname: string) => boolean;

export type MobileAppChromeRouteMetadata = {
  title?: string;
  toolbarAction: "dev-mode" | "none";
};

type RoutePathMetadata = {
  match: PathMatcher;
  title: (t: MessageTree) => string;
};

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
];

const NAV_BASED_TITLES: Partial<Record<FullPageChromeRouteKey, (t: MessageTree) => string>> = {
  dashboard: (t) => t.routes.dashboard.title,
  search: (t) => t.routes.search.title,
  symbols: (t) => t.mySymbols.title,
  portfolio: (t) => t.portfolio.title,
  calendar: (t) => t.routes.calendar.title,
};

export function resolveMobileAppChromeMetadata({
  pathname,
  activeNav,
  t,
}: {
  pathname: string | null;
  activeNav?: FullPageChromeRouteKey | null;
  t: MessageTree;
}): MobileAppChromeRouteMetadata {
  const normalizedPath = normalizePathname(pathname);
  const pathMatch = PATH_BASED_TITLES.find((candidate) => candidate.match(normalizedPath));
  if (pathMatch) {
    return {
      title: pathMatch.title(t),
      toolbarAction: "dev-mode",
    };
  }

  const titleResolver = activeNav ? NAV_BASED_TITLES[activeNav] : null;
  if (!titleResolver) {
    return {
      toolbarAction: normalizedPath.startsWith("/dashboard") ? "dev-mode" : "none",
    };
  }

  return {
    title: titleResolver(t),
    toolbarAction: normalizedPath.startsWith("/dashboard") ? "dev-mode" : "none",
  };
}
