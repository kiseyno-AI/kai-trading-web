"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { FullPageLoadingScreen } from "@/components/ui/full-page-loading";

type NavigationLoadingContextValue = {
  beginNavigation: (href?: string | URL | null) => void;
};

const NavigationLoadingContext = createContext<NavigationLoadingContextValue>({
  beginNavigation: () => {},
});

const SHOW_DELAY_MS = 120;
const MIN_VISIBLE_MS = 240;
const FAILSAFE_TIMEOUT_MS = 12_000;

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

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeKey = useMemo(() => pathname ?? "", [pathname]);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const failsafeTimerRef = useRef<number | null>(null);
  const visibleAtRef = useRef<number | null>(null);

  const hideOverlay = useCallback(() => {
    clearTimer(showTimerRef);
    clearTimer(failsafeTimerRef);
    clearTimer(hideTimerRef);

    if (visibleAtRef.current === null) {
      setVisible(false);
      return;
    }

    const elapsed = performance.now() - visibleAtRef.current;
    const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);

    if (remaining > 0) {
      hideTimerRef.current = window.setTimeout(() => {
        visibleAtRef.current = null;
        hideTimerRef.current = null;
        setVisible(false);
      }, remaining);
      return;
    }

    visibleAtRef.current = null;
    setVisible(false);
  }, []);

  const beginNavigation = useCallback(
    (href?: string | URL | null) => {
      const targetRouteKey = resolveInternalRouteKey(href);
      if (!targetRouteKey) return;

      clearTimer(showTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(failsafeTimerRef);

      showTimerRef.current = window.setTimeout(() => {
        visibleAtRef.current = performance.now();
        showTimerRef.current = null;
        setVisible(true);
      }, SHOW_DELAY_MS);

      failsafeTimerRef.current = window.setTimeout(() => {
        clearTimer(showTimerRef);
        clearTimer(hideTimerRef);
        visibleAtRef.current = null;
        failsafeTimerRef.current = null;
        setVisible(false);
      }, FAILSAFE_TIMEOUT_MS);
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      hideOverlay();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [hideOverlay, routeKey]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.skipNavigationLoading === "true") return;

      beginNavigation(anchor.href);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [beginNavigation]);

  useEffect(() => {
    return () => {
      clearTimer(showTimerRef);
      clearTimer(hideTimerRef);
      clearTimer(failsafeTimerRef);
    };
  }, []);

  return (
    <NavigationLoadingContext.Provider value={{ beginNavigation }}>
      {children}
      {visible ? <FullPageLoadingScreen overlay /> : null}
    </NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext);
}
