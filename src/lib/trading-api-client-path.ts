function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getTradingApiClientBasePath() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_TRADING_API_BASE_URL || "/api/trading");
}

export function resolveTradingApiClientPath(path: string) {
  if (!path.startsWith("/api/trading/")) {
    return path;
  }

  return `${getTradingApiClientBasePath()}${path.slice("/api/trading".length)}`;
}
