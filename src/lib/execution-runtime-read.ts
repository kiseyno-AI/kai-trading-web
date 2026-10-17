import {
  EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH,
  EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH,
  EXECUTION_RUNTIME_STATUS_CLIENT_PATH,
} from "@/lib/execution-runtime";
import { normalizeDartFundamentalsMarketDate } from "@/lib/dart-fundamentals-daily";
import { getTradingApiJsonResult, type TradingApiJsonResult } from "@/lib/trading-api-cache";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  isTradingApiObjectResponse,
  normalizeTradingApiException,
  normalizeTradingApiJsonResult,
  type TradingApiNormalizedResult,
} from "@/lib/trading-api-result";
import type {
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeStatusResponseDto,
} from "@/types/trading-api/execution-runtime";

const INVALID_STATUS_MESSAGE = "Execution runtime status response was invalid.";
const INVALID_MONITORED_SYMBOLS_MESSAGE = "Execution runtime monitored-symbols response was invalid.";
const INVALID_DAILY_BOARD_MESSAGE = "Execution runtime daily-board response was invalid.";

function hasOptionalBoardItemsField(value: Record<string, unknown>) {
  const field = value.items;
  if (field === undefined || field === null) return true;
  if (!Array.isArray(field)) return false;

  return field.every(
    (item) =>
      isTradingApiObjectResponse(item) &&
      typeof item.symbol === "string" &&
      item.symbol.trim().length > 0 &&
      typeof item.status === "string",
  );
}

function hasOptionalMonitoredItemsField(value: Record<string, unknown>) {
  const field = value.items;
  if (field === undefined || field === null) return true;
  if (!Array.isArray(field)) return false;

  return field.every(
    (item) =>
      isTradingApiObjectResponse(item) &&
      typeof item.symbol === "string" &&
      item.symbol.trim().length > 0 &&
      typeof item.monitoring_state === "string",
  );
}

function hasOptionalObjectField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return field === undefined || field === null || isTradingApiObjectResponse(field);
}

function hasOptionalStringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return field === undefined || field === null || typeof field === "string";
}

function hasOptionalBooleanField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return field === undefined || field === null || typeof field === "boolean";
}

function hasOptionalActivityCoverageField(value: Record<string, unknown>) {
  const field = value.activity_coverage;
  if (field === undefined || field === null) return true;
  if (!isTradingApiObjectResponse(field)) return false;

  return (
    hasOptionalStringField(field, "status") &&
    hasOptionalStringField(field, "status_reason") &&
    hasOptionalBooleanField(field, "exec_activity_detected") &&
    hasOptionalStringField(field, "source")
  );
}

function hasOptionalFreshnessField(value: Record<string, unknown>) {
  const field = value.freshness;
  if (field === undefined || field === null) return true;
  if (!isTradingApiObjectResponse(field)) return false;

  return (
    hasOptionalStringField(field, "status") &&
    hasOptionalBooleanField(field, "is_stale") &&
    hasOptionalBooleanField(field, "is_partial") &&
    hasOptionalBooleanField(field, "refreshing")
  );
}

function hasOptionalRequestField(value: Record<string, unknown>) {
  const field = value.request;
  if (field === undefined || field === null) return true;
  if (!isTradingApiObjectResponse(field)) return false;

  return (
    hasOptionalStringField(field, "market_date") &&
    hasOptionalBooleanField(field, "refresh")
  );
}

type ExecutionRuntimeMarketDateResponse =
  | ExecutionRuntimeDailyBoardResponseDto
  | ExecutionRuntimeMonitoredSymbolsResponseDto;

export function selectExecutionRuntimeResponseForMarketDate<T extends ExecutionRuntimeMarketDateResponse>(
  response: T | null | undefined,
  marketDate: string | null | undefined,
) {
  const expectedMarketDate = normalizeDartFundamentalsMarketDate(marketDate);
  if (!response || !expectedMarketDate) return null;

  const responseMarketDate =
    typeof response.market_date === "string"
      ? normalizeDartFundamentalsMarketDate(response.market_date)
      : null;
  if (responseMarketDate !== expectedMarketDate) return null;

  const requestedMarketDate =
    typeof response.request?.market_date === "string"
      ? normalizeDartFundamentalsMarketDate(response.request.market_date)
      : null;
  if (response.request?.market_date != null && requestedMarketDate !== expectedMarketDate) return null;

  return response;
}

export function isExecutionRuntimeStatusResponseDto(
  value: unknown,
): value is ExecutionRuntimeStatusResponseDto {
  return isTradingApiObjectResponse(value) && typeof value.status === "string";
}

export function isExecutionRuntimeMonitoredSymbolsResponseDto(
  value: unknown,
): value is ExecutionRuntimeMonitoredSymbolsResponseDto {
  return (
    isTradingApiObjectResponse(value) &&
    hasOptionalStringField(value, "market_date") &&
    hasOptionalRequestField(value) &&
    hasOptionalMonitoredItemsField(value) &&
    hasOptionalActivityCoverageField(value) &&
    hasOptionalFreshnessField(value) &&
    hasOptionalObjectField(value, "summary") &&
    hasOptionalObjectField(value, "runtime")
  );
}

export function isExecutionRuntimeDailyBoardResponseDto(
  value: unknown,
): value is ExecutionRuntimeDailyBoardResponseDto {
  return (
    isTradingApiObjectResponse(value) &&
    hasOptionalStringField(value, "market_date") &&
    hasOptionalRequestField(value) &&
    hasOptionalBoardItemsField(value) &&
    hasOptionalActivityCoverageField(value) &&
    hasOptionalFreshnessField(value) &&
    hasOptionalObjectField(value, "summary") &&
    hasOptionalObjectField(value, "runtime")
  );
}

export function normalizeExecutionRuntimeStatusResult(
  result: TradingApiJsonResult<ExecutionRuntimeStatusResponseDto>,
) {
  return normalizeTradingApiJsonResult(result, {
    invalidResponseMessage: INVALID_STATUS_MESSAGE,
    isValidData: isExecutionRuntimeStatusResponseDto,
  });
}

export function normalizeExecutionRuntimeMonitoredSymbolsResult(
  result: TradingApiJsonResult<ExecutionRuntimeMonitoredSymbolsResponseDto>,
) {
  return normalizeTradingApiJsonResult(result, {
    invalidResponseMessage: INVALID_MONITORED_SYMBOLS_MESSAGE,
    isValidData: isExecutionRuntimeMonitoredSymbolsResponseDto,
  });
}

export function normalizeExecutionRuntimeDailyBoardResult(
  result: TradingApiJsonResult<ExecutionRuntimeDailyBoardResponseDto>,
) {
  return normalizeTradingApiJsonResult(result, {
    invalidResponseMessage: INVALID_DAILY_BOARD_MESSAGE,
    isValidData: isExecutionRuntimeDailyBoardResponseDto,
  });
}

async function getExecutionRuntimeReadResult<T>(
  path: string,
  normalize: (result: TradingApiJsonResult<T>) => TradingApiNormalizedResult<T>,
  invalidResponseMessage: string,
): Promise<TradingApiNormalizedResult<T>> {
  try {
    return normalize(await getTradingApiJsonResult<T>(resolveTradingApiClientPath(path)));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        kind: "invalid-response",
        message: invalidResponseMessage,
        ok: false,
        status: null,
      };
    }

    return normalizeTradingApiException(error);
  }
}

export function getExecutionRuntimeStatusReadResult(path = EXECUTION_RUNTIME_STATUS_CLIENT_PATH) {
  return getExecutionRuntimeReadResult<ExecutionRuntimeStatusResponseDto>(
    path,
    normalizeExecutionRuntimeStatusResult,
    INVALID_STATUS_MESSAGE,
  );
}

export function getExecutionRuntimeMonitoredSymbolsReadResult(
  path = EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH,
) {
  return getExecutionRuntimeReadResult<ExecutionRuntimeMonitoredSymbolsResponseDto>(
    path,
    normalizeExecutionRuntimeMonitoredSymbolsResult,
    INVALID_MONITORED_SYMBOLS_MESSAGE,
  );
}

export function getExecutionRuntimeDailyBoardReadResult(path = EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH) {
  return getExecutionRuntimeReadResult<ExecutionRuntimeDailyBoardResponseDto>(
    path,
    normalizeExecutionRuntimeDailyBoardResult,
    INVALID_DAILY_BOARD_MESSAGE,
  );
}
