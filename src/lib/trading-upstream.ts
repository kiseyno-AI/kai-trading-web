import { NextResponse } from "next/server";

import { logWebDiagnostic, startWebDiagnosticSpan } from "@/lib/web-diagnostics";

const LOCAL_TRADING_UPSTREAM_FALLBACK = "http://127.0.0.1:8000";
export const TRADING_UPSTREAM_REQUEST_TIMEOUT_MS = 5_000;
const PROXIED_SECURITY_RESPONSE_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-embedder-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "origin-agent-cluster",
  "permissions-policy",
  "referrer-policy",
  "x-content-type-options",
  "x-download-options",
  "x-frame-options",
  "x-permitted-cross-domain-policies",
  "x-xss-protection",
] as const;

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getConfiguredTradingUpstreamBaseUrl() {
  const configuredBaseUrl =
    process.env.TRADING_API_UPSTREAM_BASE_URL ??
    process.env.TRADING_API_INTERNAL_BASE_URL;

  return configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : null;
}

function isLocalDevelopmentEnvironment() {
  return process.env.NODE_ENV !== "production";
}

type TradingUpstreamTarget = {
  authMode: "bearer" | "none";
  baseUrl: string;
  source: "configured-upstream" | "local-default";
};

type ServerTradingApiTarget = {
  authMode: TradingUpstreamTarget["authMode"];
  baseUrl: string;
  source: TradingUpstreamTarget["source"];
};

class TradingUpstreamConfigurationError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "TradingUpstreamConfigurationError";
    this.details = details;
  }
}

class TradingUpstreamTimeoutError extends Error {
  readonly path: string;
  readonly timeoutMs: number;

  constructor(path: string, timeoutMs: number) {
    super(`Trading upstream request timed out after ${formatTimeoutDuration(timeoutMs)}.`);
    this.name = "TradingUpstreamTimeoutError";
    this.path = path;
    this.timeoutMs = timeoutMs;
  }
}

type TradingUpstreamRequestOptions = {
  timeoutMs?: number | null;
};

function getTradingUpstreamAuthMode(): TradingUpstreamTarget["authMode"] {
  return process.env.TRADING_API_UPSTREAM_BEARER_TOKEN ? "bearer" : "none";
}

function getRequestMethod(init?: RequestInit) {
  return (init?.method ?? "GET").toUpperCase();
}

function formatTimeoutDuration(timeoutMs: number) {
  return timeoutMs < 1_000 ? `${timeoutMs}ms` : `${(timeoutMs / 1_000).toFixed(1)}s`;
}

function buildTradingUpstreamConfigurationDetails() {
  return {
    expectedEnv: [
      "TRADING_API_UPSTREAM_BASE_URL",
      "TRADING_API_UPSTREAM_BEARER_TOKEN",
    ],
    hasBearerToken: Boolean(process.env.TRADING_API_UPSTREAM_BEARER_TOKEN),
    hasConfiguredUpstreamBaseUrl: Boolean(getConfiguredTradingUpstreamBaseUrl()),
    hasPublicTradingApiBaseUrl: Boolean(process.env.NEXT_PUBLIC_TRADING_API_BASE_URL),
    nodeEnv: process.env.NODE_ENV ?? null,
  };
}

function resolveTradingUpstreamTarget(): TradingUpstreamTarget {
  const configuredBaseUrl = getConfiguredTradingUpstreamBaseUrl();
  if (configuredBaseUrl) {
    const authMode = getTradingUpstreamAuthMode();

    if (authMode !== "bearer" && !isLocalDevelopmentEnvironment()) {
      throw new TradingUpstreamConfigurationError(
        "TRADING_API_UPSTREAM_BEARER_TOKEN is required for deployed trading upstream requests.",
        buildTradingUpstreamConfigurationDetails(),
      );
    }

    return {
      authMode,
      baseUrl: configuredBaseUrl,
      source: "configured-upstream",
    };
  }

  if (isLocalDevelopmentEnvironment()) {
    return {
      authMode: getTradingUpstreamAuthMode(),
      baseUrl: LOCAL_TRADING_UPSTREAM_FALLBACK,
      source: "local-default",
    };
  }

  throw new TradingUpstreamConfigurationError(
    "TRADING_API_UPSTREAM_BASE_URL is required for deployed trading proxy requests.",
    buildTradingUpstreamConfigurationDetails(),
  );
}

export function getTradingUpstreamBaseUrl() {
  return resolveTradingUpstreamTarget().baseUrl;
}

export function getTradingUpstreamHeaders(init?: HeadersInit) {
  const headers = new Headers(init);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const bearerToken = process.env.TRADING_API_UPSTREAM_BEARER_TOKEN;
  if (bearerToken) {
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }

  return headers;
}

async function runWithTradingUpstreamTimeout<T>(
  path: string,
  init: RequestInit | undefined,
  { timeoutMs = TRADING_UPSTREAM_REQUEST_TIMEOUT_MS }: TradingUpstreamRequestOptions,
  load: (signal: AbortSignal | undefined) => Promise<T>,
) {
  const hasTimeout = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0;
  const initSignal = init?.signal;

  if (!hasTimeout && !initSignal) {
    return load(undefined);
  }

  const abortController = new AbortController();
  let timedOut = false;
  const abortFromInit = () => abortController.abort(initSignal?.reason);
  const timeout = hasTimeout
    ? setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, timeoutMs)
    : null;

  if (initSignal?.aborted) {
    abortFromInit();
  } else if (initSignal) {
    initSignal.addEventListener("abort", abortFromInit, { once: true });
  }

  try {
    return await load(abortController.signal);
  } catch (error) {
    if (timedOut && typeof timeoutMs === "number") {
      throw new TradingUpstreamTimeoutError(path, timeoutMs);
    }

    throw error;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
    initSignal?.removeEventListener("abort", abortFromInit);
  }
}

export async function fetchTradingUpstream(path: string, init?: RequestInit) {
  const upstreamTarget = resolveTradingUpstreamTarget();
  const method = getRequestMethod(init);
  const requestUrl = `${upstreamTarget.baseUrl}${path}`;
  const span = startWebDiagnosticSpan("http", "request", {
    authMode: upstreamTarget.authMode,
    method,
    path: requestUrl,
    scope: "server-upstream",
    upstreamSource: upstreamTarget.source,
  });

  try {
    const response = await fetch(requestUrl, {
      ...init,
      headers: getTradingUpstreamHeaders(init?.headers),
      cache: "no-store",
    });

    span.end({
      authMode: upstreamTarget.authMode,
      method,
      ok: response.ok,
      path: requestUrl,
      scope: "server-upstream",
      status: response.status,
      upstreamSource: upstreamTarget.source,
    });

    return response;
  } catch (error) {
    span.fail(error, {
      authMode: upstreamTarget.authMode,
      method,
      path: requestUrl,
      scope: "server-upstream",
      upstreamSource: upstreamTarget.source,
    });
    throw error;
  }
}

function formatFetchErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function forwardProxiedSecurityHeaders(source: Headers, target: Headers) {
  for (const headerName of PROXIED_SECURITY_RESPONSE_HEADERS) {
    const value = source.get(headerName);
    if (value) {
      target.set(headerName, value);
    }
  }
}

async function parseJsonResponse<T>(response: Response, requestLabel: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON for ${requestLabel}: ${formatFetchErrorMessage(error)}`);
  }
}

export function getServerTradingApiBaseUrl(requestHeaders?: Headers) {
  void requestHeaders;
  const upstreamTarget = resolveTradingUpstreamTarget();
  return {
    authMode: upstreamTarget.authMode,
    baseUrl: upstreamTarget.baseUrl,
    source: upstreamTarget.source,
  } satisfies ServerTradingApiTarget;
}

export async function fetchTradingUpstreamJson<T>(
  path: string,
  options: TradingUpstreamRequestOptions = {},
): Promise<T> {
  const upstreamTarget = resolveTradingUpstreamTarget();

  try {
    return await runWithTradingUpstreamTimeout(path, undefined, options, async (signal) => {
      const response = await fetchTradingUpstream(path, { signal });
      if (!response.ok) {
        throw new Error(`Failed to load ${path} from ${upstreamTarget.baseUrl}: HTTP ${response.status}`);
      }

      return parseJsonResponse<T>(response, `${path} from ${upstreamTarget.baseUrl}`);
    });
  } catch (error) {
    if (error instanceof TradingUpstreamTimeoutError) {
      throw new Error(
        `Timed out after ${formatTimeoutDuration(error.timeoutMs)} while loading ${path} from ${upstreamTarget.baseUrl}.`,
      );
    }
    if (
      error instanceof Error &&
      error.message.startsWith(`Failed to load ${path} from ${upstreamTarget.baseUrl}:`)
    ) {
      throw error;
    }

    throw new Error(
      `Failed to load ${path} from ${upstreamTarget.baseUrl}: ${formatFetchErrorMessage(error)}`,
    );
  }
}

export async function fetchServerTradingApiJson<T>(
  path: string,
  requestHeaders?: Headers,
  options: TradingUpstreamRequestOptions = {},
): Promise<T> {
  const serverTarget = getServerTradingApiBaseUrl(requestHeaders);
  const requestUrl = `${serverTarget.baseUrl}${path}`;
  const span = startWebDiagnosticSpan("http", "request", {
    authMode: serverTarget.authMode,
    method: "GET",
    path: requestUrl,
    scope: "server-render",
    upstreamSource: serverTarget.source,
  });

  try {
    return await runWithTradingUpstreamTimeout(path, undefined, options, async (signal) => {
      const response = await fetch(requestUrl, {
        headers: getTradingUpstreamHeaders(),
        cache: "no-store",
        signal,
      });
      span.end({
        authMode: serverTarget.authMode,
        method: "GET",
        ok: response.ok,
        path: requestUrl,
        scope: "server-render",
        status: response.status,
        upstreamSource: serverTarget.source,
      });

      if (!response.ok) {
        throw new Error(`Failed to load ${path} from ${serverTarget.baseUrl}: HTTP ${response.status}`);
      }

      return parseJsonResponse<T>(response, `${path} from ${serverTarget.baseUrl}`);
    });
  } catch (error) {
    if (error instanceof TradingUpstreamTimeoutError) {
      span.end({
        authMode: serverTarget.authMode,
        method: "GET",
        ok: false,
        path: requestUrl,
        scope: "server-render",
        status: 504,
        timeoutMs: error.timeoutMs,
        upstreamSource: serverTarget.source,
      });
      throw new Error(
        `Timed out after ${formatTimeoutDuration(error.timeoutMs)} while loading ${path} from ${serverTarget.baseUrl}.`,
      );
    }
    if (
      error instanceof Error &&
      error.message.startsWith(`Failed to load ${path} from ${serverTarget.baseUrl}:`)
    ) {
      throw error;
    }

    span.fail(error, {
      authMode: serverTarget.authMode,
      method: "GET",
      path: requestUrl,
      scope: "server-render",
      upstreamSource: serverTarget.source,
    });
    throw new Error(`Failed to load ${path} from ${serverTarget.baseUrl}: ${formatFetchErrorMessage(error)}`);
  }
}

function buildTradingUpstreamTimeoutResponse(error: TradingUpstreamTimeoutError, path: string) {
  return NextResponse.json(
    {
      error: "Upstream request timed out",
      message: `Timed out after ${formatTimeoutDuration(error.timeoutMs)} while loading ${path} from trading-core.`,
      path,
      timeoutMs: error.timeoutMs,
      details: buildTradingUpstreamConfigurationDetails(),
    },
    {
      status: 504,
      headers: {
        "x-kai-trading-upstream-timeout-ms": String(error.timeoutMs),
      },
    },
  );
}

export async function proxyTradingUpstreamJson(
  path: string,
  init?: RequestInit,
  options: TradingUpstreamRequestOptions = {},
) {
  try {
    const upstreamTarget = resolveTradingUpstreamTarget();
    const { body, contentType, status } = await runWithTradingUpstreamTimeout(
      path,
      init,
      options,
      async (signal) => {
        const response = await fetchTradingUpstream(path, { ...init, signal });
        return {
          body: await response.text(),
          contentType: response.headers.get("content-type") ?? "application/json",
          status: response.status,
        };
      },
    );

    logWebDiagnostic("http", "proxy-response", {
      contentType,
      method: getRequestMethod(init),
      path,
      scope: "server-bff",
      status,
      upstreamSource: upstreamTarget.source,
    });

    return new NextResponse(body, {
      status,
      headers: {
        "content-type": contentType,
        "x-kai-trading-auth-mode": upstreamTarget.authMode,
        "x-kai-trading-upstream-source": upstreamTarget.source,
      },
    });
  } catch (error) {
    logWebDiagnostic("http", "proxy-error", {
      error,
      method: getRequestMethod(init),
      path,
      scope: "server-bff",
    });

    if (error instanceof TradingUpstreamConfigurationError) {
      return NextResponse.json(
        {
          error: "Trading upstream misconfigured",
          message: error.message,
          path,
          details: error.details,
        },
        { status: 500 },
      );
    }

    if (error instanceof TradingUpstreamTimeoutError) {
      return buildTradingUpstreamTimeoutResponse(error, path);
    }

    return NextResponse.json(
      {
        error: "Upstream fetch failed",
        message: formatFetchErrorMessage(error),
        path,
        details: buildTradingUpstreamConfigurationDetails(),
      },
      { status: 502 },
    );
  }
}

export async function proxyTradingUpstreamResponse(
  path: string,
  init?: RequestInit,
  options: TradingUpstreamRequestOptions = {},
) {
  try {
    const upstreamTarget = resolveTradingUpstreamTarget();
    const responseOptions = {
      ...options,
      timeoutMs: options.timeoutMs ?? null,
    };
    const response = await runWithTradingUpstreamTimeout(path, init, responseOptions, async (signal) =>
      fetchTradingUpstream(path, { ...init, signal }),
    );
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition");
    const headers = new Headers({
      "content-type": contentType,
      "x-kai-trading-auth-mode": upstreamTarget.authMode,
      "x-kai-trading-upstream-source": upstreamTarget.source,
    });
    forwardProxiedSecurityHeaders(response.headers, headers);

    if (contentDisposition) {
      headers.set("content-disposition", contentDisposition);
    }

    logWebDiagnostic("http", "proxy-response", {
      contentType,
      method: getRequestMethod(init),
      path,
      scope: "server-bff",
      status: response.status,
      upstreamSource: upstreamTarget.source,
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    logWebDiagnostic("http", "proxy-error", {
      error,
      method: getRequestMethod(init),
      path,
      scope: "server-bff",
    });

    if (error instanceof TradingUpstreamConfigurationError) {
      return NextResponse.json(
        {
          error: "Trading upstream misconfigured",
          message: error.message,
          path,
          details: error.details,
        },
        { status: 500 },
      );
    }

    if (error instanceof TradingUpstreamTimeoutError) {
      return buildTradingUpstreamTimeoutResponse(error, path);
    }

    return NextResponse.json(
      {
        error: "Upstream fetch failed",
        message: formatFetchErrorMessage(error),
        path,
        details: buildTradingUpstreamConfigurationDetails(),
      },
      { status: 502 },
    );
  }
}
