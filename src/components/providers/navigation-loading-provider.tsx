"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { normalizeAppBasePath } from "@/lib/app-base-path";

export type PendingNavigation = {
  originRouteKey: string;
  targetRouteKey: string;
};

type NavigationLoadingContextValue = {
  beginNavigation: (href?: string | URL | null) => void;
  cancelNavigation: (href?: string | URL | null) => void;
  isNavigationPending: boolean;
  isNavigatingTo: (href?: string | URL | null) => boolean;
  pendingNavigation: PendingNavigation | null;
};

const NavigationLoadingContext = createContext<NavigationLoadingContextValue>({
  beginNavigation: () => {},
  cancelNavigation: () => {},
  isNavigationPending: false,
  isNavigatingTo: () => false,
  pendingNavigation: null,
});

const FAILSAFE_TIMEOUT_MS = 12_000;
const ROUTE_CHANGE_EVENT = "navigation-loading:route-change";

function clearTimer(timerRef: { current: number | null }) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function resolveInternalRouteKey(href: string | URL | null | undefined) {
  if (typeof window === "undefined" || !href) return null;

  try {
    const basePath = normalizeAppBasePath();
    const targetHref =
      typeof href === "string" &&
      href.startsWith("/") &&
      basePath &&
      href !== basePath &&
      !href.startsWith(`${basePath}/`)
        ? `${basePath}${href}`
        : href;
    const targetUrl = targetHref instanceof URL ? targetHref : new URL(targetHref, window.location.href);
    if (targetUrl.origin !== window.location.origin) return null;

    const targetRouteKey = `${targetUrl.pathname}${targetUrl.search}`;
    const currentRouteKey = `${window.location.pathname}${window.location.search}`;
    if (targetRouteKey === currentRouteKey) return null;

    return targetRouteKey;
  } catch {
    return null;
  }
}

function getCurrentRouteKey() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

function useCurrentRouteKey() {
  const [routeKey, setRouteKey] = useState(() => getCurrentRouteKey());

  useEffect(() => {
    const notifyRouteChange = () => {
      queueMicrotask(() => {
        window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
      });
    };
    const updateRouteKey = () => {
      setRouteKey(getCurrentRouteKey());
    };
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      notifyRouteChange();
      return result;
    };
    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    window.addEventListener(ROUTE_CHANGE_EVENT, updateRouteKey);
    window.addEventListener("popstate", updateRouteKey);
    updateRouteKey();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener(ROUTE_CHANGE_EVENT, updateRouteKey);
      window.removeEventListener("popstate", updateRouteKey);
    };
  }, []);

  return routeKey;
}

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const routeKey = useCurrentRouteKey();
  const routeKeyRef = useRef(routeKey);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const failsafeTimerRef = useRef<number | null>(null);

  const beginNavigation = useCallback((href?: string | URL | null) => {
    const targetRouteKey = resolveInternalRouteKey(href);
    if (!targetRouteKey) return;

    clearTimer(failsafeTimerRef);
    setPendingNavigation({
      originRouteKey: routeKeyRef.current,
      targetRouteKey,
    });

    failsafeTimerRef.current = window.setTimeout(() => {
      failsafeTimerRef.current = null;
      setPendingNavigation(null);
    }, FAILSAFE_TIMEOUT_MS);
  }, []);

  const cancelNavigation = useCallback((href?: string | URL | null) => {
    const targetRouteKey = resolveInternalRouteKey(href);
    if (!targetRouteKey) return;

    setPendingNavigation((currentNavigation) => {
      if (
        !currentNavigation ||
        currentNavigation.originRouteKey !== routeKeyRef.current ||
        currentNavigation.targetRouteKey !== targetRouteKey
      ) {
        return currentNavigation;
      }

      clearTimer(failsafeTimerRef);
      return null;
    });
  }, []);

  useLayoutEffect(() => {
    routeKeyRef.current = routeKey;
    if (!pendingNavigation || routeKey === pendingNavigation.originRouteKey) return;

    clearTimer(failsafeTimerRef);
    // React route cache can restore the origin screen on Back; clear the pending
    // record in the same layout commit that observes the route transition.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingNavigation(null);
  }, [pendingNavigation, routeKey]);

  useEffect(() => {
    return () => {
      clearTimer(failsafeTimerRef);
    };
  }, []);

  const isNavigatingTo = useCallback(
    (href?: string | URL | null) => {
      if (!pendingNavigation || routeKey !== pendingNavigation.originRouteKey) return false;
      return resolveInternalRouteKey(href) === pendingNavigation.targetRouteKey;
    },
    [pendingNavigation, routeKey],
  );

  const contextValue = useMemo(
    () => ({
      beginNavigation,
      cancelNavigation,
      isNavigationPending: pendingNavigation !== null && routeKey === pendingNavigation.originRouteKey,
      isNavigatingTo,
      pendingNavigation,
    }),
    [beginNavigation, cancelNavigation, isNavigatingTo, pendingNavigation, routeKey],
  );

  return (
    <NavigationLoadingContext.Provider value={contextValue}>{children}</NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext);
}
