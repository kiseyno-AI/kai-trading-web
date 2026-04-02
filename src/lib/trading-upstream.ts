import { NextResponse } from "next/server";

const LOCAL_TRADING_UPSTREAM_FALLBACK = "http://127.0.0.1:8000";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getConfiguredTradingUpstreamBaseUrl() {
  const configuredBaseUrl =
    process.env.TRADING_API_UPSTREAM_BASE_URL ??
    process.env.TRADING_API_INTERNAL_BASE_URL;

  return configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : null;
}

function getConfiguredPublicTradingApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL;
  return configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : null;
}

export function getTradingUpstreamBaseUrl() {
  const configuredBaseUrl = getConfiguredTradingUpstreamBaseUrl() ?? LOCAL_TRADING_UPSTREAM_FALLBACK;

  return trimTrailingSlash(configuredBaseUrl);
}

function getServerRequestOrigin(requestHeaders?: Headers) {
  if (!requestHeaders) return null;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return null;

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (isLocalHostname(host.split(":")[0]) ? "http" : "https");

  return `${protocol}://${host}`;
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
  return fetch(`${getTradingUpstreamBaseUrl()}${path}`, {
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
  const upstreamBaseUrl = getConfiguredTradingUpstreamBaseUrl();
  if (upstreamBaseUrl) {
    return upstreamBaseUrl;
  }

  const publicBaseUrl = getConfiguredPublicTradingApiBaseUrl();
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  const requestOrigin = getServerRequestOrigin(requestHeaders);
  if (requestOrigin) {
    const { hostname } = new URL(requestOrigin);
    if (!isLocalHostname(hostname)) {
      return `${requestOrigin}/api/trading`;
    }
  }

  return LOCAL_TRADING_UPSTREAM_FALLBACK;
}

export async function fetchTradingUpstreamJson<T>(path: string): Promise<T> {
  const upstreamBaseUrl = getTradingUpstreamBaseUrl();
  let response: Response;

  try {
    response = await fetchTradingUpstream(path);
  } catch (error) {
    throw new Error(
      `Failed to load ${path} from ${upstreamBaseUrl}: ${formatFetchErrorMessage(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${path} from ${upstreamBaseUrl}: HTTP ${response.status}`);
  }

  return parseJsonResponse<T>(response, `${path} from ${upstreamBaseUrl}`);
}

export async function fetchServerTradingApiJson<T>(path: string, requestHeaders?: Headers): Promise<T> {
  const upstreamBaseUrl = getConfiguredTradingUpstreamBaseUrl();
  if (upstreamBaseUrl) {
    return fetchTradingUpstreamJson<T>(path);
  }

  const baseUrl = getServerTradingApiBaseUrl(requestHeaders);
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`Failed to load ${path} from ${baseUrl}: ${formatFetchErrorMessage(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to load ${path} from ${baseUrl}: HTTP ${response.status}`);
  }

  return parseJsonResponse<T>(response, `${path} from ${baseUrl}`);
}

export async function proxyTradingUpstreamJson(path: string) {
  try {
    const response = await fetchTradingUpstream(path);
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Upstream fetch failed",
        message: formatFetchErrorMessage(error),
        path,
        upstreamBaseUrl: getTradingUpstreamBaseUrl(),
      },
      { status: 502 },
    );
  }
}
