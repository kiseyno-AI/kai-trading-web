import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";

function getJsonErrorMessage(parsedBody: unknown) {
  if (!parsedBody || typeof parsedBody !== "object") return null;

  const body = parsedBody as Record<string, unknown>;
  for (const key of ["detail", "message", "error"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export async function getSignalDeciderReviewJson<T>(path: string): Promise<T> {
  const response = await fetch(resolveTradingApiClientPath(path), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    parsedBody = JSON.parse(responseText) as T;
  }

  if (!response.ok) {
    const message = getJsonErrorMessage(parsedBody);
    if (message) throw new Error(message);

    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return parsedBody as T;
}
