import type { TradingApiJsonResult } from "@/lib/trading-api-cache";

export type TradingApiFailureKind =
  | "endpoint-pending"
  | "http-error"
  | "invalid-response"
  | "not-configured"
  | "timeout"
  | "upstream-unavailable";

export type TradingApiNormalizedSuccess<T> = {
  ok: true;
  data: T;
};

export type TradingApiNormalizedFailure = {
  ok: false;
  kind: TradingApiFailureKind;
  message: string;
  status: number | null;
};

export type TradingApiNormalizedResult<T> =
  | TradingApiNormalizedSuccess<T>
  | TradingApiNormalizedFailure;

type TradingApiFailureInput = {
  message?: string | null;
  status?: number | null;
};

type TradingApiResultOptions<T> = {
  invalidResponseMessage?: string;
  isValidData?: (value: unknown) => value is T;
};

const NOT_CONFIGURED_MESSAGE_PATTERN =
  /(TRADING_API_UPSTREAM|not configured|config(?:uration)? (?:is )?missing|missing config|missing credentials|no brokerage account|no accounts configured|account.*not configured)/i;
const TIMEOUT_MESSAGE_PATTERN = /\b(timed out|timeout|aborted)\b/i;

const DEFAULT_FAILURE_MESSAGES: Record<TradingApiFailureKind, string> = {
  "endpoint-pending": "Trading API endpoint is pending.",
  "http-error": "Trading API request failed.",
  "invalid-response": "Trading API returned an invalid response.",
  "not-configured": "Trading API upstream is not configured.",
  timeout: "Trading API request timed out.",
  "upstream-unavailable": "Trading API upstream is unavailable.",
};

function hasMessageSignal(value: string | null | undefined, pattern: RegExp) {
  return Boolean(value?.trim() && pattern.test(value));
}

function getFailureMessage(kind: TradingApiFailureKind, message: string | null | undefined) {
  return message?.trim() || DEFAULT_FAILURE_MESSAGES[kind];
}

export function isTradingApiObjectResponse(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function classifyTradingApiFailure({
  message = null,
  status = null,
}: TradingApiFailureInput): TradingApiFailureKind {
  if (status === 404) return "endpoint-pending";
  if (status === 401 || status === 403) return "not-configured";
  if (hasMessageSignal(message, NOT_CONFIGURED_MESSAGE_PATTERN)) return "not-configured";
  if (status === 408 || status === 504 || hasMessageSignal(message, TIMEOUT_MESSAGE_PATTERN)) return "timeout";
  if (status === 0 || (typeof status === "number" && status >= 500)) return "upstream-unavailable";

  return "http-error";
}

export function normalizeTradingApiJsonResult<T>(
  result: TradingApiJsonResult<T>,
  {
    invalidResponseMessage = DEFAULT_FAILURE_MESSAGES["invalid-response"],
    isValidData,
  }: TradingApiResultOptions<T> = {},
): TradingApiNormalizedResult<T> {
  if (result.ok) {
    if (isValidData && !isValidData(result.data)) {
      return {
        kind: "invalid-response",
        message: invalidResponseMessage,
        ok: false,
        status: null,
      };
    }

    return result;
  }

  const kind = classifyTradingApiFailure(result);
  return {
    kind,
    message: getFailureMessage(kind, result.message),
    ok: false,
    status: result.status,
  };
}

export function normalizeTradingApiException(error: unknown): TradingApiNormalizedFailure {
  const message = error instanceof Error ? error.message : String(error);
  const kind = classifyTradingApiFailure({ message, status: 0 });

  return {
    kind,
    message: getFailureMessage(kind, message),
    ok: false,
    status: 0,
  };
}
