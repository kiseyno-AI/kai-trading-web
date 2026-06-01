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

function formatTimeoutDuration(timeoutMs: number) {
  if (timeoutMs >= 1000) return `${(timeoutMs / 1000).toFixed(1)}s`;
  return `${timeoutMs}ms`;
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

export async function getSignalDeciderReviewJson<T>(
  path: string,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.trunc(options.timeoutMs)
      : null;
  const abortController = timeoutMs === null ? null : new AbortController();
  const requestInit: RequestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  };
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  if (abortController && timeoutMs !== null) {
    requestInit.signal = abortController.signal;
    timeoutId = globalThis.setTimeout(() => {
      abortController.abort();
    }, timeoutMs);
  }

  let response: Response;
  let parsedBody: unknown = null;
  try {
    response = await fetch(resolveTradingApiClientPath(path), requestInit);
    const responseText = await response.text();

    if (responseText) {
      parsedBody = JSON.parse(responseText) as T;
    }
  } catch (error) {
    if (timeoutMs !== null && isAbortError(error)) {
      throw new Error(`Timed out after ${formatTimeoutDuration(timeoutMs)} while loading ${path}.`);
    }

    throw error;
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const message = getJsonErrorMessage(parsedBody);
    if (message) throw new Error(message);

    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return parsedBody as T;
}
