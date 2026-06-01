"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useNavigationLoading, type PendingNavigation } from "@/components/providers/navigation-loading-provider";
import { withAppBasePath } from "@/lib/app-base-path";
import { logWebDiagnostic } from "@/lib/web-diagnostics";

import styles from "./navigation-failure-boundary.module.css";

type NavigationFailureKind = "chunk-load" | "render";

type NavigationFailure = {
  attemptedRouteKey?: string;
  kind: NavigationFailureKind;
  message: string;
  routeKey: string;
  source?: string;
  sourceRouteKey?: string;
};

type NavigationFailureBoundaryState = {
  error: unknown | null;
};

type NavigationFailureBoundaryInnerProps = {
  children: ReactNode;
  onError: (error: unknown, errorInfo: ErrorInfo) => void;
  renderFallback: (error: unknown) => ReactNode;
  resetToken: number;
};

const CHUNK_LOAD_FAILURE_PATTERNS = [
  /ChunkLoadError/i,
  /CSS_CHUNK_LOAD_FAILED/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /_next\/static\/chunks\//i,
  /_next\/static\/css\//i,
  /turbopack-[\w-]+\.js/i,
];

class NavigationFailureBoundaryInner extends Component<
  NavigationFailureBoundaryInnerProps,
  NavigationFailureBoundaryState
> {
  state: NavigationFailureBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: unknown): NavigationFailureBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    this.props.onError(error, errorInfo);
  }

  componentDidUpdate(previousProps: NavigationFailureBoundaryInnerProps) {
    if (previousProps.resetToken !== this.props.resetToken && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return this.props.renderFallback(this.state.error);
    }

    return this.props.children;
  }
}

function getBrowserRouteKey() {
  if (typeof window === "undefined") return "current route";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function describeReason(reason: unknown) {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}`;
  }

  if (typeof reason === "string") {
    return reason;
  }

  if (reason && typeof reason === "object") {
    const maybeReason = reason as { message?: unknown; name?: unknown };
    const name = typeof maybeReason.name === "string" ? maybeReason.name : null;
    const message = typeof maybeReason.message === "string" ? maybeReason.message : null;

    if (name && message) return `${name}: ${message}`;
    if (message) return message;
    if (name) return name;
  }

  return "Unknown route loading failure";
}

function isChunkLoadFailureText(value: string) {
  return CHUNK_LOAD_FAILURE_PATTERNS.some((pattern) => pattern.test(value));
}

function buildChunkLoadFailure(reason: unknown, source?: string): NavigationFailure | null {
  const message = describeReason(reason);
  const searchable = [message, source].filter(Boolean).join(" ");

  if (!isChunkLoadFailureText(searchable)) {
    return null;
  }

  return {
    kind: "chunk-load",
    message,
    routeKey: getBrowserRouteKey(),
    source,
  };
}

function buildRenderFailure(reason: unknown): NavigationFailure {
  return {
    kind: "render",
    message: describeReason(reason),
    routeKey: getBrowserRouteKey(),
  };
}

function attachNavigationAttempt(failure: NavigationFailure, pendingNavigation: PendingNavigation | null) {
  const currentRouteKey = getBrowserRouteKey();
  const sourceRouteKey = pendingNavigation?.originRouteKey ?? failure.sourceRouteKey ?? failure.routeKey;
  const attemptedRouteKey = pendingNavigation?.targetRouteKey ?? failure.attemptedRouteKey ?? failure.routeKey;

  return {
    ...failure,
    attemptedRouteKey,
    routeKey: currentRouteKey,
    sourceRouteKey,
  };
}

function getResourceFailure(event: Event) {
  const target = event.target;

  if (target instanceof HTMLScriptElement) {
    return buildChunkLoadFailure(`Script failed to load: ${target.src}`, target.src);
  }

  if (target instanceof HTMLLinkElement) {
    return buildChunkLoadFailure(`Stylesheet failed to load: ${target.href}`, target.href);
  }

  return null;
}

function getWindowErrorFailure(event: ErrorEvent) {
  return buildChunkLoadFailure(event.error ?? event.message, event.filename);
}

function NavigationRecoveryShell({
  failure,
  onReload,
  onRetry,
}: {
  failure: NavigationFailure;
  onReload: () => void;
  onRetry: (failure: NavigationFailure) => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const dashboardHref = withAppBasePath("/dashboard");
  const searchHref = withAppBasePath("/search");
  const portfolioHref = withAppBasePath("/portfolio");
  const calendarHref = withAppBasePath("/calendar");
  const failureLabel = failure.kind === "chunk-load" ? "Static route chunk failed to load" : "Route render failed";
  const sourceRouteKey = failure.sourceRouteKey ?? failure.routeKey;
  const attemptedRouteKey = failure.attemptedRouteKey ?? failure.routeKey;

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div className={styles.shell} role="alert" aria-live="assertive" data-navigation-recovery-shell>
      <aside className={styles.rail} aria-label="Recovery navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            KAI
          </span>
          <div className={styles.brandCopy}>
            <strong>KAI Trading</strong>
            <span>Recovery shell</span>
          </div>
        </div>

        <nav className={styles.railNav} aria-label="Primary recovery destinations">
          <a className={styles.railLink} href={dashboardHref}>
            Dashboard
          </a>
          <a className={styles.railLink} href={searchHref}>
            Search
          </a>
          <a className={styles.railLink} href={portfolioHref}>
            Assets
          </a>
          <a className={styles.railLink} href={calendarHref}>
            Calendar
          </a>
        </nav>

        <span className={styles.railLabel}>Operator-visible fallback</span>
      </aside>

      <main className={styles.main}>
        <section ref={panelRef} className={styles.panel} tabIndex={-1}>
          <p className={styles.eyebrow}>Navigation recovery</p>
          <h1>Navigation did not finish loading</h1>
          <p>
            The app could not load the assets needed for this route. Retry the route, reload the app, or return to the
            dashboard while the deployed static chunks recover.
          </p>

          <div className={styles.actions}>
            <button className={styles.primaryAction} type="button" onClick={() => onRetry(failure)}>
              Retry route
            </button>
            <button className={styles.secondaryAction} type="button" onClick={onReload}>
              Reload app
            </button>
            <a className={styles.linkAction} href={dashboardHref}>
              Back to Dashboard
            </a>
          </div>

          <dl className={styles.routeMeta}>
            <div>
              <dt>Source route</dt>
              <dd>{sourceRouteKey}</dd>
            </div>
            <div>
              <dt>Attempted route</dt>
              <dd>{attemptedRouteKey}</dd>
            </div>
            <div>
              <dt>Failure</dt>
              <dd>{failureLabel}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}

export function NavigationFailureBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { pendingNavigation } = useNavigationLoading();
  const [globalFailure, setGlobalFailure] = useState<NavigationFailure | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const pendingNavigationRef = useRef(pendingNavigation);

  useEffect(() => {
    pendingNavigationRef.current = pendingNavigation;
  }, [pendingNavigation]);

  const recover = useCallback(
    (failure?: NavigationFailure) => {
      const attemptedRouteKey = failure?.attemptedRouteKey ?? globalFailure?.attemptedRouteKey ?? null;
      setGlobalFailure(null);
      setResetToken((current) => current + 1);

      if (attemptedRouteKey && attemptedRouteKey !== getBrowserRouteKey()) {
        window.location.assign(attemptedRouteKey);
        return;
      }

      router.refresh();
    },
    [globalFailure?.attemptedRouteKey, router],
  );

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const reportFailure = useCallback((failure: NavigationFailure, channel: "boundary" | "window-error" | "rejection") => {
    logWebDiagnostic("navigation", "navigation-failure", {
      channel,
      kind: failure.kind,
      message: failure.message,
      route: failure.routeKey,
      source: failure.source,
      sourceRoute: failure.sourceRouteKey,
      attemptedRoute: failure.attemptedRouteKey,
    });
  }, []);

  const handleBoundaryError = useCallback(
    (error: unknown, errorInfo: ErrorInfo) => {
      const failure = attachNavigationAttempt(
        buildChunkLoadFailure(error) ?? buildRenderFailure(error),
        pendingNavigationRef.current,
      );
      reportFailure(
        {
          ...failure,
          source: errorInfo.componentStack ?? failure.source,
        },
        "boundary",
      );
    },
    [reportFailure],
  );

  const renderFallback = useCallback(
    (error: unknown) => {
      const failure = attachNavigationAttempt(
        buildChunkLoadFailure(error) ?? buildRenderFailure(error),
        pendingNavigationRef.current,
      );
      return <NavigationRecoveryShell failure={failure} onReload={reload} onRetry={recover} />;
    },
    [recover, reload],
  );

  useEffect(() => {
    const handleWindowError = (event: Event) => {
      const failure = getResourceFailure(event) ?? (event instanceof ErrorEvent ? getWindowErrorFailure(event) : null);

      if (!failure) return;

      event.preventDefault();
      const failureWithAttempt = attachNavigationAttempt(failure, pendingNavigationRef.current);
      reportFailure(failureWithAttempt, "window-error");
      setGlobalFailure(failureWithAttempt);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const failure = buildChunkLoadFailure(event.reason);

      if (!failure) return;

      event.preventDefault();
      const failureWithAttempt = attachNavigationAttempt(failure, pendingNavigationRef.current);
      reportFailure(failureWithAttempt, "rejection");
      setGlobalFailure(failureWithAttempt);
    };

    window.addEventListener("error", handleWindowError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [reportFailure]);

  const boundary = useMemo(
    () => (
      <NavigationFailureBoundaryInner
        onError={handleBoundaryError}
        renderFallback={renderFallback}
        resetToken={resetToken}
      >
        {children}
      </NavigationFailureBoundaryInner>
    ),
    [children, handleBoundaryError, renderFallback, resetToken],
  );

  return (
    <>
      {boundary}
      {globalFailure ? <NavigationRecoveryShell failure={globalFailure} onReload={reload} onRetry={recover} /> : null}
    </>
  );
}
