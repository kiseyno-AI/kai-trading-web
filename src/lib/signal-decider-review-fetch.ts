import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";

export const SIGNAL_DECIDER_REVIEW_REQUEST_TIMEOUT_MS = 8_000;

export async function getSignalDeciderReviewJson<T>(
  path: string,
  {
    timeoutMs = SIGNAL_DECIDER_REVIEW_REQUEST_TIMEOUT_MS,
  }: {
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(resolveTradingApiClientPath(path), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const responseText = await response.text();
    let parsedBody: unknown = null;

    if (responseText) {
      parsedBody = JSON.parse(responseText) as T;
    }

    if (!response.ok) {
      if (
        parsedBody &&
        typeof parsedBody === "object" &&
        "detail" in parsedBody &&
        typeof parsedBody.detail === "string"
      ) {
        throw new Error(parsedBody.detail);
      }

      throw new Error(`HTTP ${response.status} for ${path}`);
    }

    return parsedBody as T;
  } catch (error) {
    if (timedOut) {
      throw new Error(`Signal-decider review request timed out after ${(timeoutMs / 1000).toFixed(1)}s.`);
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
