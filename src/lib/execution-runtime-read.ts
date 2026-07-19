import {
  EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH,
  EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH,
  EXECUTION_RUNTIME_STATUS_CLIENT_PATH,
} from "@/lib/execution-runtime";
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

function hasOptionalArrayField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return field === undefined || field === null || Array.isArray(field);
}

function hasOptionalObjectField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return field === undefined || field === null || isTradingApiObjectResponse(field);
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
    hasOptionalArrayField(value, "items") &&
    hasOptionalObjectField(value, "summary") &&
    hasOptionalObjectField(value, "runtime")
  );
}

export function isExecutionRuntimeDailyBoardResponseDto(
  value: unknown,
): value is ExecutionRuntimeDailyBoardResponseDto {
  return (
    isTradingApiObjectResponse(value) &&
    hasOptionalArrayField(value, "items") &&
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
) {
  try {
    return normalize(await getTradingApiJsonResult<T>(resolveTradingApiClientPath(path)));
  } catch (error) {
    return normalizeTradingApiException(error);
  }
}

export function getExecutionRuntimeStatusReadResult(path = EXECUTION_RUNTIME_STATUS_CLIENT_PATH) {
  return getExecutionRuntimeReadResult<ExecutionRuntimeStatusResponseDto>(
    path,
    normalizeExecutionRuntimeStatusResult,
  );
}

export function getExecutionRuntimeMonitoredSymbolsReadResult(
  path = EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH,
) {
  return getExecutionRuntimeReadResult<ExecutionRuntimeMonitoredSymbolsResponseDto>(
    path,
    normalizeExecutionRuntimeMonitoredSymbolsResult,
  );
}

export function getExecutionRuntimeDailyBoardReadResult(path = EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH) {
  return getExecutionRuntimeReadResult<ExecutionRuntimeDailyBoardResponseDto>(
    path,
    normalizeExecutionRuntimeDailyBoardResult,
  );
}
