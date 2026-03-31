import { NextResponse } from "next/server";

const LOCAL_TRADING_UPSTREAM_FALLBACK = "http://127.0.0.1:8000";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getTradingUpstreamBaseUrl() {
  const configuredBaseUrl =
    process.env.TRADING_API_UPSTREAM_BASE_URL ??
    process.env.TRADING_API_INTERNAL_BASE_URL ??
    LOCAL_TRADING_UPSTREAM_FALLBACK;

  return trimTrailingSlash(configuredBaseUrl);
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

export async function fetchTradingUpstreamJson<T>(path: string): Promise<T> {
  const response = await fetchTradingUpstream(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function proxyTradingUpstreamJson(path: string) {
  const response = await fetchTradingUpstream(path);
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
