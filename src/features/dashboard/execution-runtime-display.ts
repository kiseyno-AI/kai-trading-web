import type { DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeBoardItemDto,
  ExecutionRuntimeBoardStatus,
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeMonitoringState,
  ExecutionRuntimeQuantity,
  ExecutionRuntimeStatusResponseDto,
  ExecutionRuntimeStatusValue,
} from "@/types/trading-api";

import { UNKNOWN_LABEL } from "./live-dashboard-derived-state";

type ExecutionRuntimeCopy = DashboardLiveCopy["executionRuntime"];

export type ExecutionRuntimeTone = "positive" | "neutral" | "warning";

export const EXECUTION_BOARD_STATUS_ORDER = [
  "planned",
  "accepted",
  "scheduled",
  "submitted",
  "partial",
  "filled",
  "failed",
  "cancelled",
] as const satisfies readonly ExecutionRuntimeBoardStatus[];

export type ExecutionRuntimeSummaryMetric = {
  key: string;
  label: string;
  value: string;
  tone: ExecutionRuntimeTone;
};

export type ExecutionRuntimeSummaryModel = {
  activeExecutionJobCountLabel: string;
  automationLabel: string;
  automationTone: ExecutionRuntimeTone;
  connectionLabel: string;
  connectionTone: ExecutionRuntimeTone;
  contextLabel: string | null;
  heartbeatLabel: string;
  issueLabels: string[];
  metrics: ExecutionRuntimeSummaryMetric[];
  modeLabel: string;
  monitoringLabel: string;
  monitoringTone: ExecutionRuntimeTone;
  openOrderCountLabel: string;
  statusKey: string;
  statusLabel: string;
  statusTone: ExecutionRuntimeTone;
};

export type ExecutionRuntimeMonitoredSymbolModel = {
  intentLabel: string | null;
  key: string;
  lastEventLabel: string;
  marketLabel: string | null;
  nameLabel: string;
  positionLabel: string | null;
  stateKey: string;
  stateLabel: string;
  stateTone: ExecutionRuntimeTone;
  statusSummaryLabel: string | null;
  symbol: string;
};

export type ExecutionRuntimeMonitoredSymbolsModel = {
  countLabel: string;
  errorLabel: string | null;
  items: ExecutionRuntimeMonitoredSymbolModel[];
  stateSummaryLabel: string | null;
};

export type ExecutionRuntimeBoardSummaryItem = {
  key: ExecutionRuntimeBoardStatus;
  label: string;
  tone: ExecutionRuntimeTone;
  value: string;
};

export type ExecutionRuntimeBoardRowModel = {
  failureReason: string | null;
  fillLabel: string;
  intentLabel: string;
  key: string;
  lastUpdatedLabel: string;
  marketLabel: string | null;
  nameLabel: string;
  priceLabel: string;
  statusKey: string;
  statusLabel: string;
  statusTone: ExecutionRuntimeTone;
  symbol: string;
};

export type ExecutionRuntimeDailyBoardModel = {
  boardDateLabel: string;
  errorLabel: string | null;
  rows: ExecutionRuntimeBoardRowModel[];
  summaryItems: ExecutionRuntimeBoardSummaryItem[];
  totalLabel: string;
};

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function humanizeToken(value: string | null | undefined, fallback = UNKNOWN_LABEL) {
  const token = value?.trim();
  if (!token) return fallback;

  return token
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function numberOrNull(value: ExecutionRuntimeQuantity | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[,₩$]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCount(value: number | null | undefined, numberLocale: string) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(numberLocale) : UNKNOWN_LABEL;
}

function formatOptionalNumber(value: ExecutionRuntimeQuantity | undefined, numberLocale: string) {
  const numericValue = numberOrNull(value);
  if (numericValue === null) return UNKNOWN_LABEL;

  return numericValue.toLocaleString(numberLocale, {
    maximumFractionDigits: 4,
  });
}

function getKnownStatusCount(summary: ExecutionRuntimeDailyBoardResponseDto["summary"], status: ExecutionRuntimeBoardStatus) {
  const value = summary?.[status];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getDerivedStatusCount(items: ExecutionRuntimeBoardItemDto[], status: ExecutionRuntimeBoardStatus) {
  return items.filter((item) => normalizeToken(item.status) === status).length;
}

function getStatusTone(status: ExecutionRuntimeStatusValue | null | undefined): ExecutionRuntimeTone {
  const normalizedStatus = normalizeToken(status);
  if (normalizedStatus === "ready") return "positive";
  if (normalizedStatus === "degraded" || normalizedStatus === "offline" || normalizedStatus === "kill_switched") {
    return "warning";
  }
  return "neutral";
}

export function getExecutionRuntimeStatusLabel(
  status: ExecutionRuntimeStatusValue | null | undefined,
  copy: ExecutionRuntimeCopy,
) {
  const normalizedStatus = normalizeToken(status);
  if (normalizedStatus === "ready") return copy.statuses.ready;
  if (normalizedStatus === "degraded") return copy.statuses.degraded;
  if (normalizedStatus === "offline") return copy.statuses.offline;
  if (normalizedStatus === "paused") return copy.statuses.paused;
  if (normalizedStatus === "kill_switched") return copy.statuses.killSwitched;
  return humanizeToken(status, copy.statuses.unavailable);
}

function getModeLabel(mode: string | null | undefined, copy: ExecutionRuntimeCopy) {
  const normalizedMode = normalizeToken(mode);
  if (normalizedMode === "live") return copy.modes.live;
  if (normalizedMode === "paper") return copy.modes.paper;
  if (normalizedMode === "mock") return copy.modes.mock;
  return humanizeToken(mode, copy.modes.unknown);
}

function formatHeartbeatRecency(
  value: string | null | undefined,
  copy: ExecutionRuntimeCopy,
  nowMs: number,
) {
  if (!value?.trim()) return copy.heartbeat.none;
  const timestampMs = Date.parse(value);
  if (!Number.isFinite(timestampMs)) return copy.heartbeat.invalid;

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (elapsedSeconds < 15) return copy.heartbeat.justNow;
  if (elapsedSeconds < 60) return copy.heartbeat.secondsAgo.replace("{count}", String(elapsedSeconds));

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return copy.heartbeat.minutesAgo.replace("{count}", String(elapsedMinutes));

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 48) return copy.heartbeat.hoursAgo.replace("{count}", String(elapsedHours));

  const elapsedDays = Math.floor(elapsedHours / 24);
  return copy.heartbeat.daysAgo.replace("{count}", String(elapsedDays));
}

function getIssueLabel(issue: unknown) {
  if (!issue || typeof issue !== "object") return null;
  const record = issue as Record<string, unknown>;
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim() : null;
  const code = typeof record.code === "string" && record.code.trim() ? record.code.trim() : null;
  if (message && code) return `${humanizeToken(code)}: ${message}`;
  return message ?? (code ? humanizeToken(code) : null);
}

export function buildExecutionRuntimeSummaryModel({
  copy,
  error,
  nowMs,
  numberLocale,
  status,
}: {
  copy: ExecutionRuntimeCopy;
  error: string | null;
  nowMs: number;
  numberLocale: string;
  status: ExecutionRuntimeStatusResponseDto | null;
}): ExecutionRuntimeSummaryModel {
  const statusKey = normalizeToken(status?.status) || (error ? "offline" : "unknown");
  const statusLabel = status ? getExecutionRuntimeStatusLabel(status.status, copy) : copy.statuses.unavailable;
  const statusTone = status ? getStatusTone(status.status) : "warning";
  const modeLabel = getModeLabel(status?.mode, copy);
  const execConnected = status?.exec_connected === true;
  const monitoringAlive = status?.monitoring_alive === true;
  const isKillSwitched = status?.kill_switch_enabled === true || statusKey === "kill_switched";
  const isPaused = status?.paused === true || statusKey === "paused";
  const automationEnabled = status?.automation_enabled === true;
  const connectionLabel = execConnected ? copy.connection.connected : copy.connection.disconnected;
  const connectionTone = execConnected ? "positive" : "warning";
  const monitoringLabel = monitoringAlive ? copy.monitoring.alive : copy.monitoring.missing;
  const monitoringTone = monitoringAlive ? "positive" : "warning";
  const heartbeatLabel = formatHeartbeatRecency(status?.last_heartbeat_at, copy, nowMs);
  const openOrderCountLabel = formatCount(status?.open_order_count, numberLocale);
  const activeExecutionJobCountLabel = formatCount(status?.active_execution_job_count, numberLocale);
  const automationLabel = isKillSwitched
    ? copy.safety.killSwitch
    : isPaused
      ? copy.safety.paused
      : automationEnabled
        ? copy.safety.enabled
        : copy.safety.disabled;
  const automationTone: ExecutionRuntimeTone = isKillSwitched || isPaused ? "warning" : automationEnabled ? "positive" : "neutral";
  const issueLabels = (status?.issues ?? []).map(getIssueLabel).filter((label): label is string => Boolean(label));
  const contextLabel = error
    ? `${copy.unavailablePrefix} ${error}`
    : issueLabels.length > 0
      ? copy.issuesPresent
      : null;

  return {
    activeExecutionJobCountLabel,
    automationLabel,
    automationTone,
    connectionLabel,
    connectionTone,
    contextLabel,
    heartbeatLabel,
    issueLabels,
    metrics: [
      {
        key: "open-orders",
        label: copy.metrics.openOrders,
        value: openOrderCountLabel,
        tone: status?.open_order_count ? "warning" : "neutral",
      },
      {
        key: "active-jobs",
        label: copy.metrics.activeJobs,
        value: activeExecutionJobCountLabel,
        tone: status?.active_execution_job_count ? "warning" : "neutral",
      },
      {
        key: "heartbeat",
        label: copy.metrics.heartbeat,
        value: heartbeatLabel,
        tone: monitoringTone,
      },
    ],
    modeLabel,
    monitoringLabel,
    monitoringTone,
    openOrderCountLabel,
    statusKey,
    statusLabel,
    statusTone,
  };
}

function getMonitoringStateLabel(state: ExecutionRuntimeMonitoringState | null | undefined, copy: ExecutionRuntimeCopy) {
  const normalizedState = normalizeToken(state);
  if (normalizedState === "watching_target_stop") return copy.monitoringStates.watchingTargetStop;
  if (normalizedState === "watching_fill") return copy.monitoringStates.watchingFill;
  if (normalizedState === "reconciling") return copy.monitoringStates.reconciling;
  if (normalizedState === "idle") return copy.monitoringStates.idle;
  return humanizeToken(state, copy.monitoringStates.unknown);
}

function getMonitoringStateTone(state: ExecutionRuntimeMonitoringState | null | undefined): ExecutionRuntimeTone {
  const normalizedState = normalizeToken(state);
  if (normalizedState === "reconciling") return "warning";
  if (normalizedState === "watching_target_stop" || normalizedState === "watching_fill") return "positive";
  return "neutral";
}

function formatIntent(value: string) {
  const normalizedIntent = normalizeToken(value);
  if (normalizedIntent === "target_sell") return "Target sell";
  if (normalizedIntent === "stop_sell") return "Stop sell";
  if (normalizedIntent === "next_open_buy") return "Next-open buy";
  return humanizeToken(value);
}

function formatIntentList(values: string[] | null | undefined) {
  const normalizedValues = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (normalizedValues.length === 0) return null;
  return normalizedValues.map(formatIntent).join(" / ");
}

function formatTimestampLabel(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function formatStatusCounts(statusCounts: Record<string, number> | null | undefined, numberLocale: string) {
  if (!statusCounts) return null;
  const labels = Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${humanizeToken(status)} ${count.toLocaleString(numberLocale)}`);

  return labels.length > 0 ? labels.join(" · ") : null;
}

export function buildExecutionRuntimeMonitoredSymbolsModel({
  copy,
  error,
  monitoredSymbols,
  numberLocale,
}: {
  copy: ExecutionRuntimeCopy;
  error: string | null;
  monitoredSymbols: ExecutionRuntimeMonitoredSymbolsResponseDto | null;
  numberLocale: string;
}): ExecutionRuntimeMonitoredSymbolsModel {
  const items = monitoredSymbols?.items ?? [];
  const stateCounts = monitoredSymbols?.summary?.monitoring_state_counts;
  const stateSummaryLabel = stateCounts
    ? Object.entries(stateCounts)
        .filter(([, count]) => count > 0)
        .map(([state, count]) => `${getMonitoringStateLabel(state, copy)} ${count.toLocaleString(numberLocale)}`)
        .join(" · ")
    : null;

  return {
    countLabel: formatCount(monitoredSymbols?.summary?.items_total ?? items.length, numberLocale),
    errorLabel: error ? `${copy.unavailablePrefix} ${error}` : null,
    items: items.map((item: ExecutionRuntimeMonitoredSymbolDto) => ({
      intentLabel: formatIntentList(item.planned_intents),
      key: item.symbol,
      lastEventLabel: formatTimestampLabel(item.last_event_at, copy.timestamps.none),
      marketLabel: item.market?.trim() || null,
      nameLabel: item.name?.trim() || item.symbol,
      positionLabel: item.position_side ? humanizeToken(item.position_side) : null,
      stateKey: normalizeToken(item.monitoring_state),
      stateLabel: getMonitoringStateLabel(item.monitoring_state, copy),
      stateTone: getMonitoringStateTone(item.monitoring_state),
      statusSummaryLabel: formatStatusCounts(item.status_counts, numberLocale),
      symbol: item.symbol,
    })),
    stateSummaryLabel: stateSummaryLabel || null,
  };
}

function getBoardStatusLabel(status: ExecutionRuntimeBoardStatus | null | undefined, copy: ExecutionRuntimeCopy) {
  const normalizedStatus = normalizeToken(status);
  if (normalizedStatus === "planned") return copy.boardStatuses.planned;
  if (normalizedStatus === "accepted") return copy.boardStatuses.accepted;
  if (normalizedStatus === "scheduled") return copy.boardStatuses.scheduled;
  if (normalizedStatus === "submitted") return copy.boardStatuses.submitted;
  if (normalizedStatus === "partial") return copy.boardStatuses.partial;
  if (normalizedStatus === "filled") return copy.boardStatuses.filled;
  if (normalizedStatus === "failed") return copy.boardStatuses.failed;
  if (normalizedStatus === "cancelled") return copy.boardStatuses.cancelled;
  return humanizeToken(status, copy.boardStatuses.unknown);
}

function getBoardStatusTone(status: ExecutionRuntimeBoardStatus | null | undefined): ExecutionRuntimeTone {
  const normalizedStatus = normalizeToken(status);
  if (normalizedStatus === "filled") return "positive";
  if (normalizedStatus === "partial" || normalizedStatus === "failed") return "warning";
  return "neutral";
}

function formatFillLabel(item: ExecutionRuntimeBoardItemDto, copy: ExecutionRuntimeCopy, numberLocale: string) {
  const filledQuantity = formatOptionalNumber(item.filled_quantity, numberLocale);
  const plannedQuantity = formatOptionalNumber(item.planned_quantity, numberLocale);
  if (filledQuantity === UNKNOWN_LABEL && plannedQuantity === UNKNOWN_LABEL) return copy.board.quantityUnavailable;
  if (plannedQuantity === UNKNOWN_LABEL) return filledQuantity;
  return `${filledQuantity} / ${plannedQuantity}`;
}

function formatPriceLabel(item: ExecutionRuntimeBoardItemDto, copy: ExecutionRuntimeCopy, numberLocale: string) {
  const avgFillPrice = formatOptionalNumber(item.avg_fill_price, numberLocale);
  if (avgFillPrice !== UNKNOWN_LABEL) return avgFillPrice;

  const plannedPrice = formatOptionalNumber(item.planned_price, numberLocale);
  if (plannedPrice !== UNKNOWN_LABEL) return plannedPrice;

  return copy.board.priceUnavailable;
}

export function buildExecutionRuntimeDailyBoardModel({
  board,
  copy,
  error,
  numberLocale,
}: {
  board: ExecutionRuntimeDailyBoardResponseDto | null;
  copy: ExecutionRuntimeCopy;
  error: string | null;
  numberLocale: string;
}): ExecutionRuntimeDailyBoardModel {
  const items = board?.items ?? [];
  const total = board?.summary?.items_total ?? items.length;

  return {
    boardDateLabel: board?.market_date ?? board?.request?.market_date ?? copy.timestamps.none,
    errorLabel: error ? `${copy.unavailablePrefix} ${error}` : null,
    rows: items.map((item, index) => ({
      failureReason: item.failure_reason?.trim() || null,
      fillLabel: formatFillLabel(item, copy, numberLocale),
      intentLabel: formatIntent(item.intent ?? ""),
      key: `${item.symbol || "UNKNOWN"}-${item.execution_plan_id ?? item.plan_item_id ?? index}`,
      lastUpdatedLabel: formatTimestampLabel(item.last_updated_at, copy.timestamps.none),
      marketLabel: item.market?.trim() || null,
      nameLabel: item.name?.trim() || item.symbol || UNKNOWN_LABEL,
      priceLabel: formatPriceLabel(item, copy, numberLocale),
      statusKey: normalizeToken(item.status),
      statusLabel: getBoardStatusLabel(item.status, copy),
      statusTone: getBoardStatusTone(item.status),
      symbol: item.symbol || "UNKNOWN",
    })),
    summaryItems: EXECUTION_BOARD_STATUS_ORDER.map((status) => {
      const knownCount = getKnownStatusCount(board?.summary, status);
      const count = knownCount ?? getDerivedStatusCount(items, status);

      return {
        key: status,
        label: getBoardStatusLabel(status, copy),
        tone: getBoardStatusTone(status),
        value: count.toLocaleString(numberLocale),
      };
    }),
    totalLabel: total.toLocaleString(numberLocale),
  };
}
