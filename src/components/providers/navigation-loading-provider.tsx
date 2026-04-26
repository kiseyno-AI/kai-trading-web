"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type NavigationLoadingContextValue = {
  beginNavigation: (href?: string | URL | null) => void;
  isNavigationPending: boolean;
  isNavigatingTo: (href?: string | URL | null) => boolean;
};

const NavigationLoadingContext = createContext<NavigationLoadingContextValue>({
  beginNavigation: () => {},
  isNavigationPending: false,
  isNavigatingTo: () => false,
});

const FAILSAFE_TIMEOUT_MS = 12_000;

type PendingNavigation = {
  originRouteKey: string;
  targetRouteKey: string;
};

function clearTimer(timerRef: { current: number | null }) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

function resolveInternalRouteKey(href: string | URL | null | undefined) {
  if (typeof window === "undefined" || !href) return null;

  try {
    const targetUrl = href instanceof URL ? href : new URL(href, window.location.href);
    if (targetUrl.origin !== window.location.origin) return null;

    const targetRouteKey = `${targetUrl.pathname}${targetUrl.search}`;
    const currentRouteKey = `${window.location.pathname}${window.location.search}`;
    if (targetRouteKey === currentRouteKey) return null;

    return targetRouteKey;
  } catch {
    return null;
  }
}

function getCurrentRouteKey(pathname: string | null) {
  if (typeof window === "undefined") return pathname ?? "";
  return `${window.location.pathname}${window.location.search}`;
}

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeKey = getCurrentRouteKey(pathname);
  const routeKeyRef = useRef(routeKey);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const failsafeTimerRef = useRef<number | null>(null);

  const beginNavigation = useCallback(
    (href?: string | URL | null) => {
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
    },
    [],
  );

  useEffect(() => {
    routeKeyRef.current = routeKey;
    if (pendingNavigation && routeKey !== pendingNavigation.originRouteKey) {
      clearTimer(failsafeTimerRef);
    }
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
      isNavigationPending: pendingNavigation !== null && routeKey === pendingNavigation.originRouteKey,
      isNavigatingTo,
    }),
    [beginNavigation, isNavigatingTo, pendingNavigation, routeKey],
  );

  return (
    <NavigationLoadingContext.Provider value={contextValue}>{children}</NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext);
}
