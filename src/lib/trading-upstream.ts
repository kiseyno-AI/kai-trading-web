import { NextResponse } from "next/server";

const LOCAL_TRADING_UPSTREAM_FALLBACK = "http://127.0.0.1:8000";

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
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
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

function getTradingUpstreamAuthMode(): TradingUpstreamTarget["authMode"] {
  return process.env.TRADING_API_UPSTREAM_BEARER_TOKEN ? "bearer" : "none";
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
    vercelEnv: process.env.VERCEL_ENV ?? null,
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

export function fetchTradingUpstream(path: string) {
  const upstreamTarget = resolveTradingUpstreamTarget();

  return fetch(`${upstreamTarget.baseUrl}${path}`, {
    headers: getTradingUpstreamHeaders(),
    cache: "no-store",
  });
}

function formatFetchErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

export async function fetchTradingUpstreamJson<T>(path: string): Promise<T> {
  const upstreamTarget = resolveTradingUpstreamTarget();
  let response: Response;

  try {
    response = await fetchTradingUpstream(path);
  } catch (error) {
    throw new Error(
      `Failed to load ${path} from ${upstreamTarget.baseUrl}: ${formatFetchErrorMessage(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${path} from ${upstreamTarget.baseUrl}: HTTP ${response.status}`);
  }

  return parseJsonResponse<T>(response, `${path} from ${upstreamTarget.baseUrl}`);
}

export async function fetchServerTradingApiJson<T>(path: string, requestHeaders?: Headers): Promise<T> {
  const serverTarget = getServerTradingApiBaseUrl(requestHeaders);
  let response: Response;

  try {
    response = await fetch(`${serverTarget.baseUrl}${path}`, {
      headers: getTradingUpstreamHeaders(),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`Failed to load ${path} from ${serverTarget.baseUrl}: ${formatFetchErrorMessage(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${path} from ${serverTarget.baseUrl}: HTTP ${response.status}`);
  }

  return parseJsonResponse<T>(response, `${path} from ${serverTarget.baseUrl}`);
}

export async function proxyTradingUpstreamJson(path: string) {
  try {
    const upstreamTarget = resolveTradingUpstreamTarget();
    const response = await fetchTradingUpstream(path);
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": contentType,
        "x-kai-trading-auth-mode": upstreamTarget.authMode,
        "x-kai-trading-upstream-source": upstreamTarget.source,
      },
    });
  } catch (error) {
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
