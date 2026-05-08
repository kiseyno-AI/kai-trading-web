import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  AgentFeedbackStoredItemDto,
  AgentFeedbackStoredPayloadDto,
} from "@/types/trading-api";

export const SIGNAL_DECIDER_AGENT_NAME = "signal-decider";
export const SHORT_TERM_DECIDER_AGENT_NAME = "short-term-decider";
export const DECIDER_AGENT_NAMES = [SIGNAL_DECIDER_AGENT_NAME, SHORT_TERM_DECIDER_AGENT_NAME] as const;
export const DECIDER_FEEDBACK_DASHBOARD_PATH = "/dashboard/decider-feedback";
export const SIGNAL_DECIDER_FEEDBACK_DASHBOARD_PATH = "/dashboard/signal-decider-feedback";
export const SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH = "/api/trading/agent-context/feedback";
export const SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH = "/agent-context/feedback";
export const SIGNAL_DECIDER_FEEDBACK_REVIEW_DATE_UPSTREAM_PATH = "/agent-context/feedback/review";
export const SIGNAL_DECIDER_CALENDAR_SUMMARY_UPSTREAM_PATH = "/agent-context/feedback/calendar";
export const SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT = 200;
export const SIGNAL_DECIDER_FEEDBACK_REVIEW_DATE_CLIENT_PATH = "/api/trading/agent-context/feedback/review";
export const SIGNAL_DECIDER_CALENDAR_SUMMARY_CLIENT_PATH = "/api/trading/agent-context/feedback/calendar";

export type DeciderAgentName = (typeof DECIDER_AGENT_NAMES)[number];

export const DECIDER_DATA_GAP_CATEGORIES = [
  "factor_scores",
  "turnover_liquidity",
  "signal_features",
  "intraday_orderbook",
  "fundamental_ratios",
  "dart_disclosures",
  "external_news",
  "price_quality",
  "other",
] as const;

export type DeciderDataGapCategory = (typeof DECIDER_DATA_GAP_CATEGORIES)[number];

export type SignalDeciderFeedbackStatus = "waiting" | "running" | "partial" | "completed" | "needs-review";
export type SignalDeciderCalendarStatus = "waiting" | "running" | "partial" | "completed" | "needs-review";

export type SignalDeciderAction = "buy" | "wait" | "reject" | "watch_for_trigger" | "avoid_chase" | "unknown";

export type SignalDeciderQualityTone = "positive" | "warning" | "negative" | "neutral" | "info";

export type SignalDeciderQualityKind =
  | "good-buy"
  | "weak-buy"
  | "bad-buy"
  | "missed-opportunity"
  | "correct-decision"
  | "inconclusive";

export type SignalDeciderPathOutcomeKind =
  | "target-first"
  | "stop-first"
  | "target-hit"
  | "stop-hit"
  | "ambiguous"
  | "unresolved";

export type SignalDeciderQualityTag = {
  kind: SignalDeciderQualityKind;
  label: string;
  tone: SignalDeciderQualityTone;
};

export type SignalDeciderPathOutcome = {
  kind: SignalDeciderPathOutcomeKind;
  label: string;
  tone: SignalDeciderQualityTone;
  detail: string | null;
};

export type DeciderFiveDayEvaluationState = "computed" | "not-computed" | "pending" | "insufficient" | "unknown";
export type DeciderFiveDayEvaluationReason =
  | "computed"
  | "not_mature"
  | "insufficient_price_data"
  | "missing_price_levels"
  | "not_computed"
  | "missing_evaluation"
  | "unknown";

export type DeciderFiveDayEvaluation = {
  status: string | null;
  reason: DeciderFiveDayEvaluationReason;
  label: string;
  tone: SignalDeciderQualityTone;
  state: DeciderFiveDayEvaluationState;
  tradingDaysRemaining: number | null;
  targetHitWithin5d: boolean | null;
  stopHitWithin5d: boolean | null;
  firstHit: string | null;
  firstHitLabel: string | null;
  ambiguousSameDay: boolean;
  maxFavorableExcursionPct: number | null;
  maxAdverseExcursionPct: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  windowLabel: string | null;
  dataQualityWarnings: string[];
};

export type SignalDeciderCalendarSummaryItem = {
  marketDate: string;
  decisionCount: number;
  reviewCount: number;
  status: SignalDeciderCalendarStatus | "empty";
  actionCounts: Record<SignalDeciderAction, number>;
};

export type SignalDeciderCalendarSummaryResponse = {
  request: {
    month?: string | null;
    horizons?: string[];
    primary_horizon_days?: number | null;
    evaluation_version?: string | null;
  };
  summary: {
    request?: {
      month?: string | null;
      decision_count?: number | null;
      reviewed_count?: number | null;
    };
    decision_count?: number | null;
    reviewed_count?: number | null;
  };
  items: Array<{
    market_date: string;
    calendar_status?: string | null;
    decision_count?: number | null;
    decision_actions?: Record<string, unknown> | null;
    review_status_counts?: Record<string, unknown> | null;
  }>;
};

export type SignalDeciderReviewDateResponse = {
  request: {
    market_date?: string | null;
    evaluation_version?: string | null;
    primary_horizon_days?: number | null;
    horizons?: string[];
  };
  summary: {
    count?: number | null;
    review_status_counts?: Record<string, unknown> | null;
  };
  items: Array<{
    snapshot_id?: string | number | null;
    symbol?: string | null;
    market_date?: string | null;
    run_id?: string | null;
    captured_at?: string | null;
    decision?: Record<string, unknown> | null;
    review?: Record<string, unknown> | null;
    summary?: Record<string, unknown> | null;
    context?: Record<string, unknown> | null;
  }>;
};

export type SignalDeciderOutcomeHorizon = {
  horizon: string;
  verdict: string | null;
  returnPct: number | null;
  realizedPrice: number | null;
  notes: string | null;
};

export const SIGNAL_DECIDER_REVIEW_HORIZON_DAYS = [1, 3, 5] as const;

export type SignalDeciderReviewHorizonDay = (typeof SIGNAL_DECIDER_REVIEW_HORIZON_DAYS)[number];
export type SignalDeciderHorizonEvaluationState = DeciderFiveDayEvaluationState;
export type SignalDeciderHorizonOutcomeKind = "target_hit" | "stop_hit" | "ambiguous" | "sideways";

export type SignalDeciderHorizonEvaluation = {
  day: SignalDeciderReviewHorizonDay;
  horizon: string;
  label: string;
  state: SignalDeciderHorizonEvaluationState;
  outcome: SignalDeciderHorizonOutcomeKind | null;
  status: string | null;
  statusLabel: string;
  tone: SignalDeciderQualityTone;
  returnPct: number | null;
  realizedPrice: number | null;
  verdict: string | null;
  notes: string | null;
  tradingDaysRemaining: number | null;
};

export type SignalDeciderTraceEntry = {
  label: string;
  value: string | null;
  tone: SignalDeciderQualityTone | null;
};

export type DeciderFeedbackAgreement = "agreement" | "disagreement" | "unknown";

export type DeciderFeedbackComparison = {
  symbol: string;
  marketDate: string;
  shortTermAction: SignalDeciderAction;
  shortTermActionLabel: string;
  signalAction: SignalDeciderAction;
  signalActionLabel: string;
  agreement: DeciderFeedbackAgreement;
  confidenceDelta: number | null;
  reasonContrast: string | null;
  riskContrast: string | null;
};

export type DeciderDataGapRecord = {
  agentName: string;
  category: DeciderDataGapCategory;
  companyName: string | null;
  example: string;
  itemId: string;
  marketDate: string;
  symbol: string;
};

export type DeciderDataGapCategorySummary = {
  affectedAgentCount: number;
  affectedAgents: string[];
  affectedSymbolCount: number;
  affectedSymbols: string[];
  category: DeciderDataGapCategory;
  examples: string[];
  rowCount: number;
};

export type DeciderDataGapSymbolSummary = {
  affectedAgentCount: number;
  affectedAgents: string[];
  categories: DeciderDataGapCategory[];
  companyName: string | null;
  examples: string[];
  repeatedGapCount: number;
  symbol: string;
};

export type DeciderDataGapTrend = {
  currentRowsWithDataGaps: number;
  deltaRowsWithDataGaps: number;
  previousMarketDate: string;
  previousRowsWithDataGaps: number;
};

export type DeciderDataGapReport = {
  categorySummaries: DeciderDataGapCategorySummary[];
  gapRowRatio: number;
  records: DeciderDataGapRecord[];
  rowsWithDataGaps: number;
  symbolSummaries: DeciderDataGapSymbolSummary[];
  topCategories: DeciderDataGapCategorySummary[];
  totalFeedbackRows: number;
  trend: DeciderDataGapTrend | null;
};

export type DeciderDataGapDisplayState = "has-data-gaps" | "no-feedback" | "no-data-gaps" | "no-filtered-gaps";

export type SignalDeciderFeedbackItem = {
  id: string;
  agentName: string;
  symbol: string;
  companyName: string | null;
  marketDate: string;
  runId: string | null;
  agentVersion: string | null;
  action: SignalDeciderAction;
  actionLabel: string;
  preferredAction: SignalDeciderAction;
  preferredActionLabel: string;
  nextDayOpenAction: SignalDeciderAction;
  nextDayOpenActionLabel: string;
  confidenceScore: number | null;
  convictionScore: number | null;
  thesisSummary: string | null;
  supportingEvidence: SignalDeciderTraceEntry[];
  riskFlags: string[];
  dataGapFlags: string[];
  targetPrice: number | null;
  stopLossPrice: number | null;
  expectedReturnPct: number | null;
  entryPriceBasis: string | null;
  triggerCondition: string | null;
  entryCondition: string | null;
  invalidationCondition: string | null;
  suggestedHoldingPeriod: string | null;
  contextBadges: SignalDeciderTraceEntry[];
  policyVersion: string | null;
  qualityVerdict: string | null;
  qualityReason: string | null;
  qualityTag: SignalDeciderQualityTag | null;
  reviewConclusion: string | null;
  pathOutcome: SignalDeciderPathOutcome | null;
  intradayPathResult: string | null;
  fiveDayEvaluation: DeciderFiveDayEvaluation;
  outcomeHorizons: SignalDeciderOutcomeHorizon[];
  horizonEvaluations: SignalDeciderHorizonEvaluation[];
  factorAttributions: SignalDeciderTraceEntry[];
  gateResults: SignalDeciderTraceEntry[];
  upstreamEvidence: SignalDeciderTraceEntry[];
  traceability: SignalDeciderTraceEntry[];
  capturedAt: string | null;
  receivedAt: string | null;
};

export type SignalDeciderFeedbackSummaryModel = {
  actionCounts: Record<SignalDeciderAction, number>;
  completedCount: number | null;
  currentMarketDate: string | null;
  detailHref: string;
  errorCount: number | null;
  isLatestCompletedFallback: boolean;
  items: SignalDeciderFeedbackItem[];
  marketDate: string | null;
  previewItems: SignalDeciderFeedbackItem[];
  requestedCount: number | null;
  resultCount: number;
  runId: string | null;
  status: SignalDeciderFeedbackStatus;
};

type SignalDeciderRoleSnapshot = {
  requestedCount: number | null;
  completedCount: number | null;
  errorCount: number | null;
};

export type SignalDeciderDashboardFeedbackSelection = {
  currentMarketDate: string | null;
  feedback: AgentFeedbackListResponseDto | null;
  isLatestCompletedFallback: boolean;
};

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRole(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function resolveDeciderAgentName(value: string | null | undefined): DeciderAgentName {
  const normalized = normalizeRole(value);
  return normalized === SHORT_TERM_DECIDER_AGENT_NAME ? SHORT_TERM_DECIDER_AGENT_NAME : SIGNAL_DECIDER_AGENT_NAME;
}

export function getDeciderAgentLabel(agentName: string | null | undefined) {
  return resolveDeciderAgentName(agentName) === SHORT_TERM_DECIDER_AGENT_NAME
    ? "Short-term Decider"
    : "Signal Decider";
}

export function getOppositeDeciderAgentName(agentName: string | null | undefined): DeciderAgentName {
  return resolveDeciderAgentName(agentName) === SHORT_TERM_DECIDER_AGENT_NAME
    ? SIGNAL_DECIDER_AGENT_NAME
    : SHORT_TERM_DECIDER_AGENT_NAME;
}

function normalizeMarketDate(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function normalizeAction(value: unknown): SignalDeciderAction {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (
    normalized === "buy" ||
    normalized === "wait" ||
    normalized === "reject" ||
    normalized === "watch_for_trigger"
  ) {
    return normalized;
  }
  if (
    normalized === "hold" ||
    normalized === "watch" ||
    normalized === "watchlist" ||
    normalized === "observe" ||
    normalized === "standby"
  ) {
    return "wait";
  }
  if (
    normalized === "trigger_watch" ||
    normalized === "watch_trigger" ||
    normalized === "wait_for_trigger" ||
    normalized === "conditional_buy" ||
    normalized === "buy_on_trigger"
  ) {
    return "watch_for_trigger";
  }
  if (
    normalized === "avoid" ||
    normalized === "skip"
  ) {
    return "reject";
  }
  if (
    normalized === "avoid_chase" ||
    normalized === "avoid_chasing" ||
    normalized === "do_not_chase" ||
    normalized === "no_chase"
  ) {
    return "avoid_chase";
  }
  return "unknown";
}

function resolveDecisionActions(payload: AgentFeedbackStoredPayloadDto) {
  const preferredAction = normalizeAction(
    payload.preferred_action ??
      payload.short_term_action ??
      payload.tactical_action ??
      payload.tactical_decision ??
      payload.decision_action ??
      payload.recommended_action ??
      payload.recommendation ??
      payload.action ??
      payload.decision ??
      payload.short_term_label ??
      payload.tactical_label,
  );
  const nextDayOpenAction = normalizeAction(
    payload.next_day_open_action ??
      payload.next_open_action ??
      payload.next_open_preferred_action ??
      payload.next_session_action ??
      payload.open_action,
  );
  const action = nextDayOpenAction !== "unknown" ? nextDayOpenAction : preferredAction;

  return {
    action,
    preferredAction,
    nextDayOpenAction,
  };
}

export function formatSignalDeciderActionLabel(action: SignalDeciderAction) {
  if (action === "unknown") return "Unknown";
  return humanizeToken(action);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeScore10(value: unknown): number | null {
  const score = toFiniteNumber(value);
  if (score === null) return null;
  if (score >= 0 && score <= 1) return Math.round(score * 100) / 10;
  return Math.max(0, Math.min(10, score));
}

function getStringValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && hasTextValue(value)) return value.trim();
  }
  return null;
}

function toSafeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

export function buildCalendarSummaryQuery({
  month,
  horizons,
  primaryHorizonDays,
  evaluationVersion,
}: {
  month: string;
  horizons?: string[];
  primaryHorizonDays?: number | null;
  evaluationVersion?: string | null;
}) {
  const params = new URLSearchParams({ month });

  for (const horizon of horizons ?? []) {
    const trimmed = horizon.trim();
    if (trimmed) params.append("horizons", trimmed);
  }

  if (typeof primaryHorizonDays === "number" && Number.isFinite(primaryHorizonDays)) {
    params.set("primary_horizon_days", String(Math.max(1, Math.trunc(primaryHorizonDays))));
  }

  if (hasTextValue(evaluationVersion)) params.set("evaluation_version", evaluationVersion.trim());

  return params.toString();
}

export function buildReviewDateQuery({
  marketDate,
  horizons,
  primaryHorizonDays,
  evaluationVersion,
}: {
  marketDate: string;
  horizons?: string[];
  primaryHorizonDays?: number | null;
  evaluationVersion?: string | null;
}) {
  const normalizedMarketDate = normalizeMarketDate(marketDate) ?? "";
  const params = new URLSearchParams({ market_date: normalizedMarketDate });

  for (const horizon of horizons ?? []) {
    const trimmed = horizon.trim();
    if (trimmed) params.append("horizons", trimmed);
  }

  if (typeof primaryHorizonDays === "number" && Number.isFinite(primaryHorizonDays)) {
    params.set("primary_horizon_days", String(Math.max(1, Math.trunc(primaryHorizonDays))));
  }

  if (hasTextValue(evaluationVersion)) params.set("evaluation_version", evaluationVersion.trim());

  return params.toString();
}

function toReviewDatePayload(value: unknown): AgentFeedbackStoredPayloadDto | null {
  return isRecord(value) ? (value as AgentFeedbackStoredPayloadDto) : null;
}

function toReviewDateDecisionPayload(item: SignalDeciderReviewDateResponse["items"][number]) {
  const decision = toReviewDatePayload(item.decision);
  if (decision) return decision;

  const summary = toReviewDatePayload(item.summary);
  return summary ? { ...summary, symbol: item.symbol, market_date: item.market_date } : null;
}

export function buildSignalDeciderFeedbackListFromReviewDateResponse({
  response,
  fallbackMarketDate,
}: {
  response: SignalDeciderReviewDateResponse;
  fallbackMarketDate?: string | null;
}): AgentFeedbackListResponseDto {
  const fallbackDate = normalizeMarketDate(fallbackMarketDate);
  const requestMarketDate = normalizeMarketDate(response.request.market_date) ?? fallbackDate;
  const resolvedMarketDate = requestMarketDate ?? "";

  const items = (response.items ?? []).map((item, index) => {
    const marketDate = normalizeMarketDate(item.market_date) ?? resolvedMarketDate;
    const symbol = hasTextValue(item.symbol) ? item.symbol : String(index + 1).padStart(6, "0");
    const decision = toReviewDateDecisionPayload(item);
    const summary = toReviewDatePayload(item.summary);
    const itemContext = isRecord((item as Record<string, unknown>).context)
      ? ((item as Record<string, unknown>).context as Record<string, unknown>)
      : null;
    const context = (itemContext ?? getRecordValue(summary, ["context", "symbol_day_context", "symbolDayContext"])) as
      | Record<string, unknown>
      | null;

    return {
      id: String(item.snapshot_id ?? `${marketDate}-${symbol}-${index}`).replace(/\s+/g, "-"),
      market_date: marketDate,
      symbol,
      agent: {
        name: SIGNAL_DECIDER_AGENT_NAME,
        run_id: hasTextValue(item.run_id) ? item.run_id : undefined,
      },
      summary: {
        count: 1,
      },
      feedback: decision ?? {
        role: SIGNAL_DECIDER_AGENT_NAME,
        symbol,
        market_date: marketDate,
      },
      normalized_feedback: null,
      details: toReviewDatePayload(item.review),
      context,
      received_at: hasTextValue(item.captured_at) ? item.captured_at : null,
    } satisfies AgentFeedbackStoredItemDto;
  });
  const resolvedSummaryCount = toSafeInteger(response.summary.count);
  const fallbackSummaryCount = response.summary.count === null ? 0 : Math.max(0, items.length);

  return {
    request: {
      market_date: resolvedMarketDate,
      symbols: [],
      agent_name: SIGNAL_DECIDER_AGENT_NAME,
      limit: SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
    },
    summary: {
      count: resolvedSummaryCount ?? fallbackSummaryCount,
    },
    items,
  };
}

function getRecordValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function getUnknownValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function getStringFromSources(sources: Array<Record<string, unknown> | null | undefined>, keys: string[]) {
  for (const source of sources) {
    const value = getStringValue(source, keys);
    if (value) return value;
  }
  return null;
}

function getBooleanFromSources(sources: Array<Record<string, unknown> | null | undefined>, keys: string[]) {
  for (const source of sources) {
    const value = getUnknownValue(source, keys);
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && hasTextValue(value)) {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "y", "1"].includes(normalized)) return true;
      if (["false", "no", "n", "0"].includes(normalized)) return false;
    }
  }
  return null;
}

function getFirstRecordFromSources(sources: Array<Record<string, unknown> | null | undefined>, keys: string[]) {
  for (const source of sources) {
    const value = getRecordValue(source, keys);
    if (value) return value;
  }
  return null;
}

function getValuesFromSources(sources: Array<Record<string, unknown> | null | undefined>, keys: string[]) {
  return sources
    .flatMap((source) => keys.map((key) => getUnknownValue(source, [key])))
    .filter((value) => value !== undefined && value !== null);
}

function humanizeToken(value: string) {
  return value
    .trim()
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

function formatUnknownValue(value: unknown): string | null {
  if (typeof value === "string") return hasTextValue(value) ? value.trim() : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const parts = value.map(formatUnknownValue).filter((item): item is string => hasTextValue(item));
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return null;
}

function resolveTraceTone(value: string | null | undefined): SignalDeciderQualityTone | null {
  const normalized = normalizeToken(value);
  if (!normalized) return null;
  if (normalized.includes("pass") || normalized.includes("good") || normalized.includes("positive")) return "positive";
  if (normalized.includes("fail") || normalized.includes("bad") || normalized.includes("negative")) return "negative";
  if (normalized.includes("warn") || normalized.includes("weak") || normalized.includes("missed")) return "warning";
  if (normalized.includes("info") || normalized.includes("neutral")) return "info";
  return null;
}

function normalizeTraceEntries(value: unknown): SignalDeciderTraceEntry[] {
  const fromRecord = (record: Record<string, unknown>, fallbackLabel: string | null): SignalDeciderTraceEntry | null => {
    const label =
      getStringValue(record, ["label", "title", "name", "factor", "gate", "metric", "source", "type", "key"]) ??
      fallbackLabel;
    const valueText =
      getStringValue(record, ["value", "score", "status", "result", "reason", "summary", "description", "evidence"]) ??
      formatUnknownValue(record.value ?? record.score ?? record.status ?? record.result ?? record.reason);
    const tone = resolveTraceTone(getStringValue(record, ["tone", "status", "result", "verdict"]));

    if (!label && !valueText) return null;
    return {
      label: label ? humanizeToken(label) : valueText ?? "",
      value: label ? valueText : null,
      tone,
    };
  };

  const entries = (() => {
    if (typeof value === "string" && hasTextValue(value)) {
      return [{ label: value.trim(), value: null, tone: null }];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (typeof item === "string" && hasTextValue(item)) {
          return [{ label: item.trim(), value: null, tone: null }];
        }
        if (isRecord(item)) {
          const entry = fromRecord(item, null);
          return entry ? [entry] : [];
        }
        const text = formatUnknownValue(item);
        return text ? [{ label: text, value: null, tone: null }] : [];
      });
    }

    if (isRecord(value)) {
      return Object.entries(value).flatMap(([key, item]) => {
        if (isRecord(item)) {
          const entry = fromRecord(item, key);
          return entry ? [entry] : [];
        }
        const text = formatUnknownValue(item);
        return text ? [{ label: humanizeToken(key), value: text, tone: resolveTraceTone(text) }] : [];
      });
    }

    return [];
  })();

  return entries.filter(
    (entry, index, all) =>
      all.findIndex((candidate) => candidate.label === entry.label && candidate.value === entry.value) === index,
  );
}

const OUTCOME_HORIZON_DIRECT_FIELD_KEYS = new Set([
  "horizon",
  "horizon_label",
  "period",
  "window",
  "holding_period",
  "days",
  "horizon_days",
  "horizon_day",
  "return_pct",
  "realized_return_pct",
  "outcome_return_pct",
  "pnl_pct",
  "performance_pct",
  "realized_price",
  "exit_price",
  "close_price",
  "price",
  "horizon_price",
  "verdict",
  "evaluation_verdict",
  "quality_verdict",
  "grade",
  "status",
  "result",
  "notes",
  "reason",
  "summary",
  "description",
]);

function isOutcomeHorizonDirectField(key: string) {
  return OUTCOME_HORIZON_DIRECT_FIELD_KEYS.has(key);
}

function normalizeOutcomeHorizons(value: unknown): SignalDeciderOutcomeHorizon[] {
  const fromRecord = (
    record: Record<string, unknown>,
    fallbackHorizon: string | null,
  ): SignalDeciderOutcomeHorizon | null => {
    const rawHorizon =
      getStringValue(record, ["horizon", "horizon_label", "period", "window", "holding_period"]) ??
      fallbackHorizon;
    const dayCount = toFiniteNumber(record.days ?? record.horizon_days ?? record.horizon_day);
    const horizon = rawHorizon ?? (dayCount !== null ? `${dayCount}d` : null);
    const verdict = getStringValue(record, ["verdict", "evaluation_verdict", "quality_verdict", "grade", "status", "result"]);
    const notes = getStringValue(record, ["notes", "reason", "summary", "description"]);
    const returnPct = toFiniteNumber(
      record.return_pct ??
        record.realized_return_pct ??
        record.outcome_return_pct ??
        record.pnl_pct ??
        record.performance_pct,
    );
    const realizedPrice = toFiniteNumber(
      record.realized_price ?? record.exit_price ?? record.close_price ?? record.price ?? record.horizon_price,
    );

    if (!horizon && !verdict && !notes && returnPct === null && realizedPrice === null) return null;

    return {
      horizon: horizon ? humanizeToken(horizon) : "Outcome",
      verdict: verdict ? humanizeToken(verdict) : null,
      returnPct,
      realizedPrice,
      notes,
    };
  };

  const entries = (() => {
    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (isRecord(item)) {
          const entry = fromRecord(item, null);
          return entry ? [entry] : [];
        }
        const text = formatUnknownValue(item);
        return text
          ? [
              {
                horizon: "Outcome",
                verdict: null,
                returnPct: null,
                realizedPrice: null,
                notes: text,
              },
            ]
          : [];
      });
    }

    if (isRecord(value)) {
      const direct = fromRecord(value, null);
      const valueEntries = Object.entries(value);
      const hasNestedHorizonRecords = valueEntries.some(([key, item]) => !isOutcomeHorizonDirectField(key) && isRecord(item));
      const hasOnlyDirectFields =
        direct !== null &&
        valueEntries.some(([key]) => isOutcomeHorizonDirectField(key)) &&
        valueEntries.every(([key]) => isOutcomeHorizonDirectField(key));

      if (hasOnlyDirectFields) return [direct];

      return valueEntries.flatMap(([key, item]) => {
        if (isRecord(item)) {
          const entry = fromRecord(item, key);
          return entry ? [entry] : [];
        }
        if (hasNestedHorizonRecords && isOutcomeHorizonDirectField(key)) return [];
        const text = formatUnknownValue(item);
        return text
          ? [
              {
                horizon: humanizeToken(key),
                verdict: null,
                returnPct: null,
                realizedPrice: null,
                notes: text,
              },
            ]
          : [];
      });
    }

    return [];
  })();

  return entries.filter(
    (entry, index, all) =>
      all.findIndex((candidate) => candidate.horizon === entry.horizon && candidate.verdict === entry.verdict) === index,
  );
}

function normalizeQualityTag({
  action,
  sources,
}: {
  action: SignalDeciderAction;
  sources: Array<Record<string, unknown> | null | undefined>;
}): {
  qualityVerdict: string | null;
  qualityReason: string | null;
  qualityTag: SignalDeciderQualityTag | null;
} {
  const rawVerdict = getStringFromSources(sources, [
    "quality_verdict",
    "evaluation_verdict",
    "decision_quality_verdict",
    "decision_quality",
    "outcome_verdict",
    "verdict",
    "grade",
    "tag",
  ]);
  const normalizedVerdict = normalizeToken(rawVerdict);
  const missed =
    getBooleanFromSources(sources, ["has_missed_opportunity", "missed_opportunity", "is_missed_opportunity"]) === true ||
    normalizedVerdict.includes("missed");
  const badBuy =
    getBooleanFromSources(sources, ["is_bad_buy", "bad_buy", "has_bad_buy"]) === true ||
    normalizedVerdict.includes("bad_buy") ||
    normalizedVerdict.includes("false_positive");
  const weakBuy =
    getBooleanFromSources(sources, ["is_weak_buy", "weak_buy", "has_weak_buy"]) === true ||
    normalizedVerdict.includes("weak_buy");
  const goodBuy = normalizedVerdict.includes("good_buy") || normalizedVerdict.includes("correct_buy");
  const correctDecision =
    normalizedVerdict.includes("correct_wait") ||
    normalizedVerdict.includes("correct_reject") ||
    normalizedVerdict.includes("correct_decision") ||
    normalizedVerdict === "correct";
  const inconclusive =
    normalizedVerdict.includes("pending") ||
    normalizedVerdict.includes("unknown") ||
    normalizedVerdict.includes("inconclusive");
  const qualityReason = getStringFromSources(sources, [
    "quality_reason",
    "evaluation_reason",
    "verdict_reason",
    "outcome_reason",
    "reason",
    "notes",
  ]);

  if (missed) {
    return {
      qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : "Missed opportunity",
      qualityReason,
      qualityTag: { kind: "missed-opportunity", label: "Missed opportunity", tone: "warning" },
    };
  }

  if (badBuy || (action === "buy" && normalizedVerdict.includes("bad"))) {
    return {
      qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : "Bad buy",
      qualityReason,
      qualityTag: { kind: "bad-buy", label: "Bad buy", tone: "negative" },
    };
  }

  if (weakBuy || (action === "buy" && normalizedVerdict.includes("weak"))) {
    return {
      qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : "Weak buy",
      qualityReason,
      qualityTag: { kind: "weak-buy", label: "Weak buy", tone: "warning" },
    };
  }

  if (goodBuy) {
    return {
      qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : "Good buy",
      qualityReason,
      qualityTag: { kind: "good-buy", label: "Good buy", tone: "positive" },
    };
  }

  if (correctDecision) {
    return {
      qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : "Correct decision",
      qualityReason,
      qualityTag: { kind: "correct-decision", label: "Correct", tone: "positive" },
    };
  }

  if (inconclusive) {
    return {
      qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : "Inconclusive",
      qualityReason,
      qualityTag: { kind: "inconclusive", label: "Inconclusive", tone: "neutral" },
    };
  }

  return {
    qualityVerdict: rawVerdict ? humanizeToken(rawVerdict) : null,
    qualityReason,
    qualityTag: rawVerdict ? { kind: "inconclusive", label: humanizeToken(rawVerdict), tone: "info" } : null,
  };
}

function buildPathOutcome(
  kind: SignalDeciderPathOutcomeKind,
  detail: string | null,
): SignalDeciderPathOutcome {
  switch (kind) {
    case "target-first":
      return { kind, label: "Target first", tone: "positive", detail };
    case "target-hit":
      return { kind, label: "Target hit", tone: "positive", detail };
    case "stop-first":
      return { kind, label: "Stop first", tone: "negative", detail };
    case "stop-hit":
      return { kind, label: "Stop hit", tone: "negative", detail };
    case "ambiguous":
      return { kind, label: "Ambiguous path", tone: "warning", detail };
    case "unresolved":
      return { kind, label: "Unresolved path", tone: "neutral", detail };
  }
}

function normalizePathOutcome(sources: Array<Record<string, unknown> | null | undefined>) {
  const rawResult = getStringFromSources(sources, [
    "target_stop_result",
    "target_stop_outcome",
    "stop_target_result",
    "path_result",
    "intraday_path_result",
    "intraday_result",
    "first_trigger",
    "triggered_first",
    "hit_order",
    "trade_result",
  ]);
  const normalizedResult = normalizeToken(rawResult);
  const detail =
    getStringFromSources(sources, [
      "path_reason",
      "path_summary",
      "target_stop_reason",
      "target_stop_detail",
      "intraday_path_summary",
      "intraday_summary",
      "replay_summary",
      "review_summary",
    ]) ?? (rawResult ? humanizeToken(rawResult) : null);
  const targetHitFirst =
    getBooleanFromSources(sources, ["target_hit_first", "target_first", "hit_target_first"]) === true ||
    ((normalizedResult.includes("target") || normalizedResult.includes("profit")) &&
      (normalizedResult.includes("first") || normalizedResult.includes("before")));
  const stopHitFirst =
    getBooleanFromSources(sources, ["stop_hit_first", "stop_first", "hit_stop_first"]) === true ||
    ((normalizedResult.includes("stop") || normalizedResult.includes("loss")) &&
      (normalizedResult.includes("first") || normalizedResult.includes("before")));
  const targetHit =
    targetHitFirst ||
    getBooleanFromSources(sources, ["target_hit", "hit_target", "take_profit_hit"]) === true ||
    normalizedResult.includes("target_hit") ||
    normalizedResult.includes("take_profit") ||
    normalizedResult.includes("profit_target");
  const stopHit =
    stopHitFirst ||
    getBooleanFromSources(sources, ["stop_hit", "hit_stop", "stop_loss_hit"]) === true ||
    normalizedResult.includes("stop_hit") ||
    normalizedResult.includes("stop_loss");

  if (targetHitFirst) return buildPathOutcome("target-first", detail);
  if (stopHitFirst) return buildPathOutcome("stop-first", detail);
  if (targetHit && stopHit) return buildPathOutcome("ambiguous", detail);
  if (targetHit) return buildPathOutcome("target-hit", detail);
  if (stopHit) return buildPathOutcome("stop-hit", detail);
  if (
    normalizedResult.includes("ambiguous") ||
    normalizedResult.includes("mixed") ||
    normalizedResult.includes("unknown_order")
  ) {
    return buildPathOutcome("ambiguous", detail);
  }
  if (
    normalizedResult.includes("unresolved") ||
    normalizedResult.includes("not_hit") ||
    normalizedResult.includes("neither")
  ) {
    return buildPathOutcome("unresolved", detail);
  }

  if (
    normalizedResult.includes("pending") ||
    normalizedResult.includes("not_computed") ||
    tokenIndicatesPendingFiveDayWindow(normalizedResult)
  ) {
    return null;
  }

  return rawResult ? buildPathOutcome("ambiguous", detail) : null;
}

const FIVE_DAY_EVALUATION_RECORD_KEYS = [
  "five_day_evaluation",
  "five_day_decider_evaluation",
  "five_trading_day_evaluation",
  "five_trading_days_evaluation",
  "evaluation_5d",
  "evaluation_5_day",
  "evaluation_5_trading_days",
  "decider_evaluation_5d",
  "decider_feedback_evaluation",
  "target_stop_evaluation",
  "target_stop_5d",
  "target_stop_outcome_5d",
  "short_term_evaluation",
  "short_term_decider_evaluation",
];

const FIVE_DAY_STATUS_LABELS: Record<string, string> = {
  target_hit_before_stop: "Target before stop",
  stop_hit_before_target: "Stop before target",
  target_and_stop_same_day_ambiguous: "Target/stop same-day ambiguous",
  neither_hit_within_5d: "Neither hit within 5d",
  invalid_missing_price_data: "Insufficient price data",
  invalid_no_price_levels: "Missing target/stop levels",
  not_applicable_wait_or_reject: "Not applicable",
  not_computed_yet: "Evaluation not computed",
  pending_evaluation_window: "Pending 5D window",
  insufficient_data: "Insufficient price data",
  trigger_not_confirmed: "Trigger not confirmed",
  trigger_confirmed_then_target_hit: "Trigger confirmed, target hit",
  trigger_confirmed_then_stop_hit: "Trigger confirmed, stop hit",
  avoid_chase_validated: "Avoid-chase validated",
  avoid_chase_missed_upside: "Avoid-chase missed upside",
};

const FIVE_DAY_EVALUATION_WINDOW_DAYS = 5;

function tokenIncludesAny(token: string, values: string[]) {
  return values.some((value) => token === value || token.includes(value));
}

function tokenIndicatesPendingFiveDayWindow(token: string) {
  return tokenIncludesAny(token, [
    "pending_evaluation_window",
    "evaluation_window_pending",
    "pending_5d_window",
    "pending_five_day_window",
    "window_pending",
    "wait_for_window",
    "not_mature",
    "immature",
    "unmatured",
    "pending_maturity",
    "window_not_complete",
    "window_incomplete",
    "not_enough_elapsed_trading_days",
    "needs_more_trading_days",
    "forward_window_open",
    "forward_window_pending",
  ]);
}

function tokenIndicatesMissingPriceData(token: string) {
  return tokenIncludesAny(token, [
    "invalid_missing_price_data",
    "invalid_price_data",
    "missing_price_data",
    "price_data_missing",
    "missing_price_bar",
    "missing_price_bars",
    "missing_daily_bar",
    "missing_daily_bars",
    "missing_ohlcv",
    "insufficient_price_data",
    "price_bars_missing",
  ]);
}

function normalizeFiveDayStatus(rawStatus: string | null, rawReason: string | null = null) {
  const normalized = normalizeToken(rawStatus);
  const normalizedReason = normalizeToken(rawReason);
  if (!normalized) {
    if (tokenIndicatesPendingFiveDayWindow(normalizedReason)) return "pending_evaluation_window";
    if (tokenIndicatesMissingPriceData(normalizedReason)) return "invalid_missing_price_data";
    if (normalizedReason === "missing_price_levels" || normalizedReason === "no_price_levels") {
      return "invalid_no_price_levels";
    }
    if (normalizedReason === "not_computed" || normalizedReason === "missing_evaluation") return "not_computed_yet";
    return null;
  }

  if (
    normalized === "target_hit_first" ||
    normalized === "target_first" ||
    normalized === "hit_target_first" ||
    normalized === "target_before_stop" ||
    normalized === "target_hit_before_stop_loss" ||
    normalized === "take_profit_before_stop"
  ) {
    return "target_hit_before_stop";
  }

  if (
    normalized === "stop_hit_first" ||
    normalized === "stop_first" ||
    normalized === "hit_stop_first" ||
    normalized === "stop_before_target" ||
    normalized === "stop_loss_before_target"
  ) {
    return "stop_hit_before_target";
  }

  if (
    normalized === "ambiguous" ||
    normalized === "same_day_ambiguous" ||
    normalized === "target_stop_same_day_ambiguous" ||
    normalized === "target_and_stop_ambiguous"
  ) {
    return "target_and_stop_same_day_ambiguous";
  }

  if (
    normalized === "neither" ||
    normalized === "no_hit" ||
    normalized === "not_hit" ||
    normalized === "neither_hit" ||
    normalized === "unresolved" ||
    normalized === "no_target_or_stop_hit"
  ) {
    return "neither_hit_within_5d";
  }

  if (
    normalized === "pending" ||
    tokenIndicatesPendingFiveDayWindow(normalized) ||
    tokenIndicatesPendingFiveDayWindow(normalizedReason)
  ) {
    return "pending_evaluation_window";
  }

  if (tokenIndicatesMissingPriceData(normalized) || tokenIndicatesMissingPriceData(normalizedReason)) {
    return "invalid_missing_price_data";
  }
  if (normalized === "missing_price_levels" || normalized === "no_price_levels") return "invalid_no_price_levels";
  if (normalized === "insufficient" || normalized === "incomplete_data") return "insufficient_data";
  if (normalized === "not_computed" || normalized === "missing_evaluation") return "not_computed_yet";
  if (normalizedReason === "not_computed" || normalizedReason === "missing_evaluation") return "not_computed_yet";

  return normalized;
}

function getFiveDayEvaluationTone(status: string | null): SignalDeciderQualityTone {
  if (
    status === "target_hit_before_stop" ||
    status === "trigger_confirmed_then_target_hit" ||
    status === "avoid_chase_validated"
  ) {
    return "positive";
  }

  if (
    status === "stop_hit_before_target" ||
    status === "trigger_confirmed_then_stop_hit" ||
    status === "avoid_chase_missed_upside"
  ) {
    return "negative";
  }

  if (
    status === "target_and_stop_same_day_ambiguous" ||
    status === "invalid_missing_price_data" ||
    status === "invalid_no_price_levels" ||
    status === "insufficient_data"
  ) {
    return "warning";
  }

  return "neutral";
}

function getFiveDayEvaluationState(status: string | null): DeciderFiveDayEvaluationState {
  if (status === "not_computed_yet") return "not-computed";
  if (status === "pending_evaluation_window") return "pending";
  if (
    status === "insufficient_data" ||
    status === "invalid_missing_price_data" ||
    status === "invalid_no_price_levels"
  ) {
    return "insufficient";
  }
  if (!status) return "unknown";
  return "computed";
}

function getFiveDayEvaluationReason(status: string | null): DeciderFiveDayEvaluationReason {
  if (status === "pending_evaluation_window") return "not_mature";
  if (status === "invalid_no_price_levels") return "missing_price_levels";
  if (status === "insufficient_data" || status === "invalid_missing_price_data") return "insufficient_price_data";
  if (status === "not_computed_yet") return "not_computed";
  if (!status) return "unknown";
  return "computed";
}

function getFiveDayEvaluationLabel(status: string | null, rawLabel: string | null) {
  if (
    status === "pending_evaluation_window" ||
    status === "not_computed_yet" ||
    status === "insufficient_data" ||
    status === "invalid_missing_price_data"
  ) {
    return FIVE_DAY_STATUS_LABELS[status];
  }
  if (rawLabel) return rawLabel;
  if (!status) return FIVE_DAY_STATUS_LABELS.not_computed_yet;
  return FIVE_DAY_STATUS_LABELS[status] ?? humanizeToken(status);
}

function isSignalDeciderReviewHorizonDay(value: number | null): value is SignalDeciderReviewHorizonDay {
  return value === 1 || value === 3 || value === 5;
}

function formatReviewHorizonLabel(day: SignalDeciderReviewHorizonDay) {
  return `${day}D`;
}

function parseReviewHorizonDay(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  const compact = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const match =
    /^d\+?(\d+)$/.exec(compact) ??
    /^(\d+)d$/.exec(compact) ??
    /^(\d+)day(?:s)?$/.exec(compact) ??
    /^(\d+)tradingday(?:s)?$/.exec(compact) ??
    /^day(\d+)$/.exec(compact) ??
    /^(\d+)$/.exec(compact);
  if (!match?.[1]) return null;
  const day = Number.parseInt(match[1], 10);
  return isSignalDeciderReviewHorizonDay(day) ? day : null;
}

function getReviewHorizonDayFromRecord(record: Record<string, unknown>, fallbackHorizon: string | null) {
  const dayCount = toSafeInteger(record.days ?? record.horizon_days ?? record.horizon_day ?? record.horizon_trading_days);
  if (isSignalDeciderReviewHorizonDay(dayCount)) return dayCount;

  const rawHorizon =
    getStringValue(record, ["horizon", "horizon_label", "period", "window", "holding_period"]) ??
    fallbackHorizon;
  return parseReviewHorizonDay(rawHorizon);
}

function getHorizonEvaluationState({
  hasComputedEvidence,
  rawReason,
  rawState,
  rawStatus,
}: {
  hasComputedEvidence: boolean;
  rawReason: string | null;
  rawState: string | null;
  rawStatus: string | null;
}): SignalDeciderHorizonEvaluationState {
  const normalizedState = normalizeToken(rawState);
  const normalizedStatus = normalizeToken(rawStatus);
  const normalizedReason = normalizeToken(rawReason);
  const tokens = [normalizedState, normalizedStatus, normalizedReason];

  if (tokens.some(tokenIndicatesPendingFiveDayWindow)) return "pending";
  if (
    tokens.some(tokenIndicatesMissingPriceData) ||
    tokens.some((token) => token === "insufficient_data" || token === "invalid_no_price_levels" || token === "missing_price_levels")
  ) {
    return "insufficient";
  }
  if (tokens.some((token) => token === "not_computed" || token === "not_computed_yet" || token === "missing_evaluation")) {
    return "not-computed";
  }
  if (tokens.some((token) => token === "unknown" || token === "unrecognized")) return "unknown";
  if (normalizedState === "computed" || normalizedState === "complete" || normalizedState === "completed" || hasComputedEvidence) {
    return "computed";
  }
  return "unknown";
}

function getHorizonOutcomeKind({
  rawStatus,
  state,
  stopHit,
  targetHit,
}: {
  rawStatus: string | null;
  state: SignalDeciderHorizonEvaluationState;
  stopHit: boolean | null;
  targetHit: boolean | null;
}): SignalDeciderHorizonOutcomeKind | null {
  if (state !== "computed") return null;

  const normalizedStatus = normalizeToken(rawStatus);
  if (
    targetHit === true &&
    stopHit === true ||
    tokenIncludesAny(normalizedStatus, [
      "ambiguous",
      "same_day_ambiguous",
      "target_and_stop_same_day",
      "target_and_stop_ambiguous",
      "unknown_order",
    ])
  ) {
    return "ambiguous";
  }
  if (
    (targetHit === false && stopHit === false) ||
    tokenIncludesAny(normalizedStatus, [
      "neither",
      "neither_hit",
      "neither_hit_within",
      "no_hit",
      "not_hit",
      "unresolved",
      "no_target_or_stop_hit",
    ])
  ) {
    return "sideways";
  }
  if (
    targetHit === true ||
    tokenIncludesAny(normalizedStatus, [
      "target_hit_before_stop",
      "target_before_stop",
      "target_first",
      "hit_target_first",
      "target_hit",
      "hit_target",
      "take_profit_hit",
      "profit_target_hit",
      "trigger_confirmed_then_target_hit",
    ])
  ) {
    return "target_hit";
  }
  if (
    stopHit === true ||
    tokenIncludesAny(normalizedStatus, [
      "stop_hit_before_target",
      "stop_before_target",
      "stop_first",
      "hit_stop_first",
      "stop_hit",
      "hit_stop",
      "stop_loss_hit",
      "trigger_confirmed_then_stop_hit",
    ])
  ) {
    return "stop_hit";
  }

  return "sideways";
}

function getHorizonEvaluationTone(
  state: SignalDeciderHorizonEvaluationState,
  outcome: SignalDeciderHorizonOutcomeKind | null,
): SignalDeciderQualityTone {
  if (state === "insufficient") return "warning";
  if (state !== "computed") return "neutral";
  if (outcome === "target_hit") return "positive";
  if (outcome === "stop_hit") return "negative";
  if (outcome === "ambiguous") return "warning";
  return "neutral";
}

function getHorizonStatusLabel(
  state: SignalDeciderHorizonEvaluationState,
  outcome: SignalDeciderHorizonOutcomeKind | null,
) {
  if (state === "pending") return "Pending maturity";
  if (state === "insufficient") return "Insufficient price data";
  if (state === "not-computed") return "Not computed";
  if (state === "unknown") return "Unknown";
  if (outcome === "target_hit") return "Target hit";
  if (outcome === "stop_hit") return "Stop hit";
  if (outcome === "ambiguous") return "Target/stop same day";
  return "Sideways";
}

function getHorizonTargetHit(record: Record<string, unknown>) {
  return getBooleanFromSources([record], [
    "target_hit_within_horizon",
    "target_hit_within_window",
    "target_hit_within_period",
    "target_hit_within_days",
    "target_hit",
    "hit_target",
    "take_profit_hit",
  ]);
}

function getHorizonStopHit(record: Record<string, unknown>) {
  return getBooleanFromSources([record], [
    "stop_hit_within_horizon",
    "stop_hit_within_window",
    "stop_hit_within_period",
    "stop_hit_within_days",
    "stop_hit",
    "hit_stop",
    "stop_loss_hit",
  ]);
}

function buildHorizonEvaluationFromRecord(
  record: Record<string, unknown>,
  fallbackHorizon: string | null,
): SignalDeciderHorizonEvaluation | null {
  const day = getReviewHorizonDayFromRecord(record, fallbackHorizon);
  if (!day) return null;

  const rawStatus = getStringValue(record, [
    "status",
    "result",
    "outcome",
    "evaluation_status",
    "evaluation_outcome",
    "outcome_status",
    "target_stop_result",
    "target_stop_outcome",
    "path_result",
    "first_hit",
    "hit_order",
    "verdict",
    "evaluation_verdict",
    "quality_verdict",
    "grade",
  ]);
  const rawState = getStringValue(record, ["state", "evaluation_state", "coverage_state"]);
  const rawReason = getStringValue(record, [
    "status_reason",
    "reason_code",
    "evaluation_status_reason",
    "evaluation_reason_code",
    "not_computed_reason",
    "failure_reason",
    "invalid_reason",
    "missing_reason",
    "reason",
    "notes",
    "summary",
    "description",
  ]);
  const returnPct = toFiniteNumber(
    record.return_pct ??
      record.realized_return_pct ??
      record.outcome_return_pct ??
      record.pnl_pct ??
      record.performance_pct,
  );
  const realizedPrice = toFiniteNumber(
    record.realized_price ?? record.exit_price ?? record.close_price ?? record.price ?? record.horizon_price,
  );
  const verdict = getStringValue(record, ["verdict", "evaluation_verdict", "quality_verdict", "grade"]);
  const notes = getStringValue(record, ["notes", "reason", "summary", "description"]);
  const targetHit = getHorizonTargetHit(record);
  const stopHit = getHorizonStopHit(record);
  const state = getHorizonEvaluationState({
    hasComputedEvidence:
      returnPct !== null ||
      realizedPrice !== null ||
      hasTextValue(verdict) ||
      hasTextValue(notes) ||
      targetHit !== null ||
      stopHit !== null ||
      hasTextValue(rawStatus),
    rawReason,
    rawState,
    rawStatus,
  });
  const outcome = getHorizonOutcomeKind({ rawStatus, state, stopHit, targetHit });
  const statusLabel = getHorizonStatusLabel(state, outcome);

  return {
    day,
    horizon: `${day}d`,
    label: formatReviewHorizonLabel(day),
    state,
    outcome,
    status: normalizeToken(rawStatus) || normalizeToken(rawState) || null,
    statusLabel,
    tone: getHorizonEvaluationTone(state, outcome),
    returnPct,
    realizedPrice,
    verdict: verdict ? humanizeToken(verdict) : null,
    notes,
    tradingDaysRemaining: getIntegerFromRecord(record, [
      "trading_days_remaining",
      "remaining_trading_days",
      "evaluation_days_remaining",
      "days_remaining",
      "bars_remaining",
      "forward_bars_remaining",
    ]),
  };
}

function getPrimitiveHorizonRecord(value: unknown): Record<string, unknown> {
  const numericValue = toFiniteNumber(value);
  if (numericValue !== null) return { return_pct: numericValue };
  return { status: value };
}

function normalizeHorizonEvaluations(value: unknown): SignalDeciderHorizonEvaluation[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (isRecord(item) ? buildHorizonEvaluationFromRecord(item, null) ?? [] : []));
  }

  if (!isRecord(value)) return [];

  const direct = buildHorizonEvaluationFromRecord(value, null);
  const valueEntries = Object.entries(value);
  const hasNestedHorizonRecords = valueEntries.some(([key, item]) => parseReviewHorizonDay(key) !== null || isRecord(item));
  const hasOnlyDirectFields =
    direct !== null &&
    valueEntries.some(([key]) => isOutcomeHorizonDirectField(key) || key === "state" || key === "evaluation_state") &&
    valueEntries.every(([key]) => isOutcomeHorizonDirectField(key) || key === "state" || key === "evaluation_state");

  if (hasOnlyDirectFields) return [direct];

  return valueEntries.flatMap(([key, item]) => {
    const fallbackDay = parseReviewHorizonDay(key);
    if (isRecord(item)) return buildHorizonEvaluationFromRecord(item, key) ?? [];
    if (fallbackDay !== null) return buildHorizonEvaluationFromRecord(getPrimitiveHorizonRecord(item), key) ?? [];
    if (hasNestedHorizonRecords && isOutcomeHorizonDirectField(key)) return [];
    return [];
  });
}

function buildFiveDayHorizonEvaluation(
  evaluation: DeciderFiveDayEvaluation,
): SignalDeciderHorizonEvaluation {
  const statusForOutcome =
    evaluation.status ??
    (evaluation.targetHitWithin5d === true
      ? "target_hit"
      : evaluation.stopHitWithin5d === true
        ? "stop_hit"
        : evaluation.targetHitWithin5d === false && evaluation.stopHitWithin5d === false
          ? "neither_hit"
          : null);
  const outcome = getHorizonOutcomeKind({
    rawStatus: statusForOutcome,
    state: evaluation.state,
    stopHit: evaluation.stopHitWithin5d,
    targetHit: evaluation.targetHitWithin5d,
  });
  return {
    day: 5,
    horizon: "5d",
    label: "5D",
    state: evaluation.state,
    outcome,
    status: evaluation.status,
    statusLabel: getHorizonStatusLabel(evaluation.state, outcome),
    tone: getHorizonEvaluationTone(evaluation.state, outcome),
    returnPct: null,
    realizedPrice: null,
    verdict: evaluation.state === "computed" ? evaluation.label : null,
    notes: null,
    tradingDaysRemaining: evaluation.tradingDaysRemaining,
  };
}

function buildEmptyHorizonEvaluation(day: SignalDeciderReviewHorizonDay): SignalDeciderHorizonEvaluation {
  return {
    day,
    horizon: `${day}d`,
    label: formatReviewHorizonLabel(day),
    state: "not-computed",
    outcome: null,
    status: "not_computed_yet",
    statusLabel: "Not computed",
    tone: "neutral",
    returnPct: null,
    realizedPrice: null,
    verdict: null,
    notes: null,
    tradingDaysRemaining: null,
  };
}

function getHorizonEvaluationRank(evaluation: SignalDeciderHorizonEvaluation) {
  if (evaluation.state === "computed") return 5;
  if (evaluation.state === "pending" || evaluation.state === "insufficient") return 4;
  if (evaluation.state === "not-computed") return 2;
  return 1;
}

function getHorizonEvaluationDetailScore(evaluation: SignalDeciderHorizonEvaluation) {
  return [
    evaluation.outcome,
    evaluation.returnPct !== null ? "return" : null,
    evaluation.realizedPrice !== null ? "price" : null,
    evaluation.verdict,
    evaluation.notes,
    evaluation.tradingDaysRemaining !== null ? "remaining" : null,
  ].filter((value) => value !== null).length;
}

function chooseHorizonEvaluation(
  current: SignalDeciderHorizonEvaluation | undefined,
  next: SignalDeciderHorizonEvaluation,
) {
  if (!current) return next;
  const currentRank = getHorizonEvaluationRank(current);
  const nextRank = getHorizonEvaluationRank(next);
  if (nextRank > currentRank) return next;
  if (nextRank < currentRank) return current;
  return getHorizonEvaluationDetailScore(next) > getHorizonEvaluationDetailScore(current) ? next : current;
}

function buildHorizonEvaluations({
  candidates,
  fiveDayEvaluation,
}: {
  candidates: SignalDeciderHorizonEvaluation[];
  fiveDayEvaluation: DeciderFiveDayEvaluation;
}): SignalDeciderHorizonEvaluation[] {
  const byDay = new Map<SignalDeciderReviewHorizonDay, SignalDeciderHorizonEvaluation>();

  for (const candidate of candidates) {
    byDay.set(candidate.day, chooseHorizonEvaluation(byDay.get(candidate.day), candidate));
  }

  const fiveDayHorizon = buildFiveDayHorizonEvaluation(fiveDayEvaluation);
  byDay.set(5, chooseHorizonEvaluation(byDay.get(5), fiveDayHorizon));

  return SIGNAL_DECIDER_REVIEW_HORIZON_DAYS.map((day) => byDay.get(day) ?? buildEmptyHorizonEvaluation(day));
}

function formatLocalDateOnly(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseUtcDateOnly(value: string | null | undefined) {
  const normalized = normalizeMarketDate(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [year, month, day] = normalized.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function countLikelyTradingDaysAfterMarketDate(marketDate: string | null, referenceDate: string | null) {
  const start = parseUtcDateOnly(marketDate);
  const end = parseUtcDateOnly(referenceDate);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;

  const cursor = new Date(start.getTime());
  let count = 0;
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function getIntegerFromRecord(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = toSafeInteger(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function getFiveDayTradingDaysRemaining({
  evaluationReferenceDate,
  marketDate,
  record,
}: {
  evaluationReferenceDate?: string | null;
  marketDate?: string | null;
  record: Record<string, unknown> | null | undefined;
}) {
  const directRemaining = getIntegerFromRecord(record, [
    "trading_days_remaining",
    "remaining_trading_days",
    "evaluation_days_remaining",
    "days_remaining",
    "bars_remaining",
    "forward_bars_remaining",
  ]);
  if (directRemaining !== null) return directRemaining;

  const requiredTradingDays =
    getIntegerFromRecord(record, [
      "required_trading_days",
      "required_forward_trading_days",
      "evaluation_trading_days",
      "window_trading_days",
      "horizon_trading_days",
    ]) ?? FIVE_DAY_EVALUATION_WINDOW_DAYS;
  const availableTradingDays = getIntegerFromRecord(record, [
    "available_trading_days",
    "available_forward_trading_days",
    "observed_trading_days",
    "elapsed_trading_days",
    "completed_trading_days",
    "available_forward_bars",
    "observed_forward_bars",
    "price_bars_available",
  ]);
  if (availableTradingDays !== null) return Math.max(0, requiredTradingDays - availableTradingDays);

  const referenceDate = normalizeMarketDate(evaluationReferenceDate) ?? formatLocalDateOnly();
  const normalizedMarketDate = normalizeMarketDate(marketDate);
  if (!normalizedMarketDate || !referenceDate) return null;
  const elapsedTradingDays = countLikelyTradingDaysAfterMarketDate(normalizedMarketDate, referenceDate);
  return Math.max(0, requiredTradingDays - elapsedTradingDays);
}

function isFiveDayEvaluationWindowPending({
  evaluationReferenceDate,
  marketDate,
  record,
}: {
  evaluationReferenceDate?: string | null;
  marketDate?: string | null;
  record: Record<string, unknown> | null | undefined;
}) {
  const maturityFlag = getBooleanFromSources([record], [
    "window_mature",
    "is_mature",
    "mature",
    "evaluation_mature",
    "is_evaluation_mature",
  ]);
  if (maturityFlag === false) return true;
  if (maturityFlag === true) return false;

  const completeFlag = getBooleanFromSources([record], [
    "window_complete",
    "is_complete",
    "complete",
    "evaluation_window_complete",
    "is_window_complete",
  ]);
  if (completeFlag === false) return true;
  if (completeFlag === true) return false;

  const remaining = getFiveDayTradingDaysRemaining({ evaluationReferenceDate, marketDate, record });
  return remaining !== null && remaining > 0;
}

function hasFiveDayEvaluationEvidence(record: Record<string, unknown> | null | undefined) {
  if (!record) return false;
  const status = getStringValue(record, [
    "five_day_status",
    "five_day_outcome",
    "five_day_evaluation_status",
    "five_day_evaluation_outcome",
    "evaluation_status",
    "evaluation_outcome",
    "outcome_status",
    "outcome",
    "status",
    "result",
    "target_stop_result",
    "target_stop_outcome",
  ]);
  const normalizedStatus = normalizeFiveDayStatus(status);
  if (normalizedStatus && FIVE_DAY_STATUS_LABELS[normalizedStatus]) return true;

  return [
    "target_hit_within_5d",
    "target_hit_within_5_trading_days",
    "stop_hit_within_5d",
    "stop_loss_hit_within_5d",
    "first_hit",
    "which_happened_first",
    "ambiguous_same_day",
    "target_and_stop_same_day",
    "max_favorable_excursion_pct",
    "mfe_pct",
    "max_adverse_excursion_pct",
    "mae_pct",
    "evaluation_window_start",
    "evaluation_window_end",
    "expected_evaluation_window_start",
    "expected_evaluation_window_end",
    "evaluation_window",
    "expected_evaluation_window",
    "window_start",
    "window_end",
    "data_quality_warnings",
    "data_warnings",
    "evaluation_status_reason",
    "five_day_evaluation_status_reason",
    "status_reason",
    "reason_code",
    "trading_days_remaining",
    "remaining_trading_days",
    "available_trading_days",
    "available_forward_bars",
    "window_complete",
    "window_mature",
  ].some((key) => key in record);
}

function getFiveDayEvaluationRecord(sources: Array<Record<string, unknown> | null | undefined>) {
  for (const source of sources) {
    for (const key of FIVE_DAY_EVALUATION_RECORD_KEYS) {
      const value = getRecordValue(source, [key]);
      if (hasFiveDayEvaluationEvidence(value)) return value;
    }
  }

  return sources.find(hasFiveDayEvaluationEvidence) ?? null;
}

function normalizeEvaluationDate(value: unknown) {
  if (typeof value !== "string" || !hasTextValue(value)) return null;
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function getEvaluationWindow(record: Record<string, unknown> | null | undefined) {
  const windowRecord = getRecordValue(record, [
    "evaluation_window",
    "expected_evaluation_window",
    "window",
    "window_dates",
    "five_day_window",
    "expected_five_day_window",
    "evaluation_dates",
  ]);
  const windowArray = Array.isArray(record?.evaluation_window)
    ? record?.evaluation_window
    : Array.isArray(record?.expected_evaluation_window)
      ? record?.expected_evaluation_window
    : Array.isArray(record?.window)
      ? record?.window
      : null;
  const windowText =
    typeof record?.evaluation_window === "string"
      ? record.evaluation_window
      : typeof record?.expected_evaluation_window === "string"
        ? record.expected_evaluation_window
      : typeof record?.window === "string"
        ? record.window
        : null;
  const start =
    normalizeEvaluationDate(
      record?.evaluation_window_start ??
        record?.expected_evaluation_window_start ??
        record?.expected_window_start ??
        record?.window_start ??
        record?.start_date ??
        record?.from_date ??
        record?.first_evaluation_date,
    ) ??
    normalizeEvaluationDate(
      windowRecord?.start ??
        windowRecord?.start_date ??
        windowRecord?.from ??
        windowRecord?.first_date ??
        windowRecord?.market_date_start,
    ) ??
    (windowArray ? normalizeEvaluationDate(windowArray[0]) : null);
  const end =
    normalizeEvaluationDate(
      record?.evaluation_window_end ??
        record?.expected_evaluation_window_end ??
        record?.expected_window_end ??
        record?.window_end ??
        record?.end_date ??
        record?.to_date ??
        record?.through_date ??
        record?.last_evaluation_date,
    ) ??
    normalizeEvaluationDate(
      windowRecord?.end ??
        windowRecord?.end_date ??
        windowRecord?.to ??
        windowRecord?.last_date ??
        windowRecord?.market_date_end,
    ) ??
    (windowArray ? normalizeEvaluationDate(windowArray[1]) : null);
  const label = start && end ? `${start} -> ${end}` : start ?? end ?? (hasTextValue(windowText) ? windowText.trim() : null);

  return { start, end, label };
}

function normalizeFirstHitLabel(status: string | null, rawFirstHit: string | null) {
  const normalizedFirstHit = normalizeToken(rawFirstHit);
  if (
    status === "target_hit_before_stop" ||
    normalizedFirstHit === "target" ||
    normalizedFirstHit === "target_first" ||
    normalizedFirstHit === "take_profit"
  ) {
    return { firstHit: "target", firstHitLabel: "Target first" };
  }
  if (
    status === "stop_hit_before_target" ||
    normalizedFirstHit === "stop" ||
    normalizedFirstHit === "stop_first" ||
    normalizedFirstHit === "stop_loss"
  ) {
    return { firstHit: "stop", firstHitLabel: "Stop first" };
  }
  if (status === "target_and_stop_same_day_ambiguous" || normalizedFirstHit.includes("ambiguous")) {
    return { firstHit: "same-day-ambiguous", firstHitLabel: "Same-day ambiguous" };
  }
  if (status === "neither_hit_within_5d" || normalizedFirstHit === "neither" || normalizedFirstHit === "none") {
    return { firstHit: "neither", firstHitLabel: "Neither" };
  }
  if (status === "trigger_not_confirmed") {
    return { firstHit: "trigger-not-confirmed", firstHitLabel: "Trigger not confirmed" };
  }
  if (status === "trigger_confirmed_then_target_hit") {
    return { firstHit: "target", firstHitLabel: "Trigger then target" };
  }
  if (status === "trigger_confirmed_then_stop_hit") {
    return { firstHit: "stop", firstHitLabel: "Trigger then stop" };
  }
  if (rawFirstHit) return { firstHit: normalizedFirstHit || rawFirstHit, firstHitLabel: humanizeToken(rawFirstHit) };
  return { firstHit: null, firstHitLabel: null };
}

function getWarningsFromEvaluationRecord(record: Record<string, unknown> | null | undefined, ambiguousSameDay: boolean) {
  const warnings = [
    ...flattenStringList(record?.data_quality_warnings),
    ...flattenStringList(record?.data_warnings),
    ...flattenStringList(record?.quality_warnings),
    ...flattenStringList(record?.warnings),
    ...flattenStringList(record?.issues),
    ...flattenStringList(record?.missing_price_dates),
    ...flattenStringList(record?.missing_price_bar_dates),
    ...flattenStringList(record?.missing_price_bars),
    ...flattenStringList(record?.missing_bar_dates),
    ...flattenStringList(record?.missing_daily_bars),
    ...flattenStringList(record?.missing_ohlcv_dates),
    ...flattenStringList(record?.missing_dates),
    ...flattenStringList(record?.invalid_reason),
    ...flattenStringList(record?.stale_reason),
  ].filter((warning, index, all) => all.indexOf(warning) === index);

  if (
    ambiguousSameDay &&
    !warnings.some((warning) => normalizeToken(warning).includes("sequence") || normalizeToken(warning).includes("ambiguous"))
  ) {
    warnings.unshift("Target and stop were inside the same daily candle; intraday sequence cannot be proven.");
  }

  return warnings;
}

function normalizeFiveDayEvaluation({
  evaluationReferenceDate,
  marketDate,
  sources,
}: {
  evaluationReferenceDate?: string | null;
  marketDate?: string | null;
  sources: Array<Record<string, unknown> | null | undefined>;
}): DeciderFiveDayEvaluation {
  const record = getFiveDayEvaluationRecord(sources);
  if (!record) {
    const tradingDaysRemaining = getFiveDayTradingDaysRemaining({
      evaluationReferenceDate,
      marketDate,
      record: null,
    });
    const status =
      tradingDaysRemaining !== null && tradingDaysRemaining > 0
        ? "pending_evaluation_window"
        : "not_computed_yet";

    return {
      status,
      reason: getFiveDayEvaluationReason(status),
      label: getFiveDayEvaluationLabel(status, null),
      tone: getFiveDayEvaluationTone(status),
      state: getFiveDayEvaluationState(status),
      tradingDaysRemaining,
      targetHitWithin5d: null,
      stopHitWithin5d: null,
      firstHit: null,
      firstHitLabel: null,
      ambiguousSameDay: false,
      maxFavorableExcursionPct: null,
      maxAdverseExcursionPct: null,
      windowStart: null,
      windowEnd: null,
      windowLabel: null,
      dataQualityWarnings: [],
    };
  }

  const rawStatus =
    getStringValue(record, [
      "five_day_status",
      "five_day_outcome",
      "five_day_evaluation_status",
      "five_day_evaluation_outcome",
      "evaluation_status",
      "evaluation_outcome",
      "outcome_status",
      "outcome",
      "status",
      "result",
      "target_stop_result",
      "target_stop_outcome",
      "short_term_outcome",
    ]);
  const rawReason = getStringValue(record, [
    "five_day_evaluation_status_reason",
    "evaluation_status_reason",
    "status_reason",
    "reason_code",
    "evaluation_reason_code",
    "not_computed_reason",
    "failure_reason",
    "invalid_reason",
    "missing_reason",
    "reason",
  ]);
  const normalizedStatus = normalizeFiveDayStatus(rawStatus, rawReason);
  const tradingDaysRemaining = getFiveDayTradingDaysRemaining({
    evaluationReferenceDate,
    marketDate,
    record,
  });
  const isPendingWindow = isFiveDayEvaluationWindowPending({
    evaluationReferenceDate,
    marketDate,
    record,
  });
  const status =
    isPendingWindow &&
    (!normalizedStatus ||
      normalizedStatus === "insufficient_data" ||
      normalizedStatus === "invalid_missing_price_data" ||
      normalizedStatus === "not_computed_yet")
      ? "pending_evaluation_window"
      : normalizedStatus ??
        (getWarningsFromEvaluationRecord(record, false).length > 0 ? "insufficient_data" : "not_computed_yet");
  const targetHitWithin5d = getBooleanFromSources([record], [
    "target_hit_within_5d",
    "target_hit_within_5_trading_days",
    "target_hit_5d",
    "target_hit",
    "hit_target",
    "take_profit_hit",
  ]);
  const stopHitWithin5d = getBooleanFromSources([record], [
    "stop_hit_within_5d",
    "stop_loss_hit_within_5d",
    "stop_hit_5d",
    "stop_hit",
    "hit_stop",
    "stop_loss_hit",
  ]);
  const rawFirstHit = getStringValue(record, [
    "first_hit",
    "first_event",
    "first_trigger",
    "which_happened_first",
    "hit_first",
    "hit_order",
    "target_stop_sequence",
    "sequence",
  ]);
  const firstHit = normalizeFirstHitLabel(status, rawFirstHit);
  const ambiguousSameDay =
    status === "target_and_stop_same_day_ambiguous" ||
    getBooleanFromSources([record], [
      "ambiguous_same_day",
      "same_day_ambiguous",
      "target_and_stop_same_day",
      "target_and_stop_inside_same_daily_candle",
      "same_candle_ambiguous",
      "ambiguous_intraday_sequence",
      "cannot_prove_sequence",
    ]) === true;
  const window = getEvaluationWindow(record);
  const rawLabel = getStringValue(record, ["label", "outcome_label", "status_label", "display_label"]);

  return {
    status,
    reason: getFiveDayEvaluationReason(status),
    label: getFiveDayEvaluationLabel(status, rawLabel),
    tone: getFiveDayEvaluationTone(status),
    state: getFiveDayEvaluationState(status),
    tradingDaysRemaining,
    targetHitWithin5d,
    stopHitWithin5d,
    firstHit: firstHit.firstHit,
    firstHitLabel: firstHit.firstHitLabel,
    ambiguousSameDay,
    maxFavorableExcursionPct: toFiniteNumber(
      record.max_favorable_excursion_pct ??
        record.mfe_pct ??
        record.max_favorable_pct ??
        record.max_upside_pct ??
        record.max_gain_pct,
    ),
    maxAdverseExcursionPct: toFiniteNumber(
      record.max_adverse_excursion_pct ??
        record.mae_pct ??
        record.max_adverse_pct ??
        record.max_downside_pct ??
        record.max_drawdown_pct,
    ),
    windowStart: window.start,
    windowEnd: window.end,
    windowLabel: window.label,
    dataQualityWarnings: getWarningsFromEvaluationRecord(record, ambiguousSameDay),
  };
}

function resolveReviewConclusion({
  action,
  outcomeHorizons,
  pathOutcome,
  qualityTag,
  sources,
}: {
  action: SignalDeciderAction;
  outcomeHorizons: SignalDeciderOutcomeHorizon[];
  pathOutcome: SignalDeciderPathOutcome | null;
  qualityTag: SignalDeciderQualityTag | null;
  sources: Array<Record<string, unknown> | null | undefined>;
}) {
  const explicitConclusion = getStringFromSources(sources, [
    "review_conclusion",
    "human_conclusion",
    "conclusion",
    "headline",
    "insight_headline",
    "review_insight_headline",
    "decision_review_headline",
  ]);
  if (explicitConclusion) return explicitConclusion;

  if (qualityTag?.kind === "good-buy") return "Buy decision was supported by the replay.";
  if (qualityTag?.kind === "weak-buy") return "Buy worked only weakly or missed the review hurdle.";
  if (qualityTag?.kind === "bad-buy") return "Buy decision failed the replay review.";
  if (qualityTag?.kind === "missed-opportunity") return "Non-buy decision missed a later opportunity.";
  if (qualityTag?.kind === "correct-decision") return "Original decision was supported by later action.";

  if (pathOutcome?.kind === "target-first" || pathOutcome?.kind === "target-hit") {
    return action === "buy" ? "Target path supported the buy." : "Later price action favored a buy.";
  }
  if (pathOutcome?.kind === "stop-first" || pathOutcome?.kind === "stop-hit") {
    return action === "buy" ? "Stop path challenged the buy." : "Avoiding the trade was supported.";
  }
  if (pathOutcome?.kind === "ambiguous") return "Replay path is ambiguous.";
  if (pathOutcome?.kind === "unresolved") return "Replay outcome is still unresolved.";

  if (outcomeHorizons.length > 0) return "Review outcome is available by horizon.";
  return null;
}

function flattenStringList(value: unknown): string[] {
  if (typeof value === "string" && hasTextValue(value)) return [value.trim()];
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (isRecord(item)) {
        return (
          getStringValue(item, ["label", "title", "message", "reason", "summary", "text", "description"]) ??
          JSON.stringify(item)
        );
      }
      return null;
    })
    .filter((item): item is string => hasTextValue(item));
}

function getPayload(item: AgentFeedbackStoredItemDto): AgentFeedbackStoredPayloadDto {
  if (isRecord(item.normalized_feedback)) return item.normalized_feedback;
  if (isRecord(item.feedback)) return item.feedback;
  return {};
}

function getContextCompanyName(symbol: string, context: Record<string, unknown> | null | undefined) {
  const symbolDayContext = getRecordValue(context, ["symbol_day_context", "symbolDayContext"]);
  const company = getRecordValue(symbolDayContext, ["company"]);
  const normalizedSymbol = symbol.trim().toUpperCase();

  for (const value of [
    getStringValue(company, ["name_ko", "name", "company_name", "corp_name"]),
    getStringValue(symbolDayContext, ["company_name", "companyName", "name_ko", "name"]),
  ]) {
    if (value && value.toUpperCase() !== normalizedSymbol) return value;
  }

  return null;
}

function getRiskFlags(payload: AgentFeedbackStoredPayloadDto): string[] {
  const details = isRecord(payload.details) ? payload.details : null;
  const decisionSupport = getRecordValue(details, ["decision_support", "decisionSupport"]);

  return [
    ...flattenStringList(payload.decision_risks),
    ...flattenStringList(payload.risk_flags),
    ...flattenStringList(details?.decision_risks),
    ...flattenStringList(details?.risk_flags),
    ...flattenStringList(decisionSupport?.decision_risks),
  ].filter((item, index, all) => all.indexOf(item) === index);
}

function getStringListFromSources(
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: string[],
) {
  return sources
    .flatMap((source) => keys.flatMap((key) => flattenStringList(source?.[key])))
    .filter((item, index, all) => all.indexOf(item) === index);
}

function getFlagTextFromValue(label: string, value: unknown) {
  if (value === true) return label;
  if (value === false || value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0 ? `${label}: ${value}` : null;
  if (typeof value === "string" && hasTextValue(value)) {
    const normalized = normalizeToken(value);
    if (["false", "no", "n", "0", "none", "ok", "pass"].includes(normalized)) return null;
    if (["true", "yes", "y", "1", "missing", "stale", "incomplete", "absent"].includes(normalized)) return label;
    return `${label}: ${value.trim()}`;
  }
  return null;
}

function getBooleanishFlagEntries(
  sources: Array<Record<string, unknown> | null | undefined>,
  definitions: Array<{ label: string; keys: string[] }>,
) {
  return definitions
    .flatMap(({ label, keys }) =>
      sources.flatMap((source) =>
        keys.map((key) => getFlagTextFromValue(label, getUnknownValue(source, [key]))),
      ),
    )
    .filter((item, index, all): item is string => hasTextValue(item) && all.indexOf(item) === index);
}

function getDataGapFlags(sources: Array<Record<string, unknown> | null | undefined>) {
  return [
    ...getStringListFromSources(sources, [
      "data_gaps",
      "data_gap_flags",
      "data_gap_reasons",
      "data_gap_reason",
      "missing_context",
      "missing_context_flags",
      "missing_context_reasons",
      "missing_features",
      "missing_fields",
      "missing_source_fields",
      "missing_inputs",
      "missing_input_fields",
      "quality_warnings",
      "data_quality_warnings",
      "price_quality_warnings",
      "context_quality_warnings",
    ]),
    ...getBooleanishFlagEntries(sources, [
      {
        label: "Missing factor score",
        keys: [
          "missing_factor_score",
          "missing_factor_scores",
          "factor_score_missing",
          "factor_scores_missing",
          "has_missing_factor_score",
        ],
      },
      {
        label: "Turnover/liquidity anomaly",
        keys: [
          "turnover_liquidity_anomaly",
          "liquidity_anomaly",
          "turnover_anomaly",
          "volume_anomaly",
          "turnover_missing",
          "liquidity_missing",
          "volume_missing",
          "has_turnover_liquidity_anomaly",
        ],
      },
      {
        label: "Signal feature absence",
        keys: [
          "signal_feature_absence",
          "missing_signal_features",
          "signal_features_absent",
          "signal_features_missing",
          "feature_snapshot_missing",
        ],
      },
      {
        label: "Stale intraday context",
        keys: [
          "stale_intraday_context",
          "intraday_context_stale",
          "stale_context",
          "intraday_context_unavailable",
          "intraday_unavailable",
          "orderbook_unavailable",
          "order_book_unavailable",
          "vwap_unavailable",
        ],
      },
      {
        label: "Incomplete intraday context",
        keys: ["incomplete_intraday_context", "intraday_context_incomplete", "incomplete_context"],
      },
      {
        label: "Missing fundamental ratios",
        keys: [
          "missing_fundamental_ratios",
          "fundamental_ratios_missing",
          "valuation_missing",
          "valuation_ratios_missing",
        ],
      },
      {
        label: "Missing DART disclosures",
        keys: ["missing_dart_disclosures", "dart_disclosures_missing", "disclosures_missing"],
      },
      {
        label: "Missing external news",
        keys: ["missing_external_news", "external_news_missing", "news_missing"],
      },
      {
        label: "Price quality issue",
        keys: ["price_quality_issue", "price_quality_warning", "missing_price_data", "stale_price_data"],
      },
    ]),
  ].filter((item, index, all) => all.indexOf(item) === index);
}

function normalizeContextBadgeEntries(sources: Array<Record<string, unknown> | null | undefined>) {
  const entries: SignalDeciderTraceEntry[] = [];

  const pushCount = (label: string, value: unknown) => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) return;
    entries.push({
      label,
      value: `${numericValue.toLocaleString("en-US")} recent`,
      tone: numericValue > 0 ? "info" : "neutral",
    });
  };

  const pushText = (label: string, value: string | null) => {
    if (!value) return;
    entries.push({
      label,
      value,
      tone: resolveTraceTone(value) ?? "info",
    });
  };

  for (const source of sources) {
    const contextBadgeSource = getRecordValue(source, [
      "context_badges",
      "contextBadges",
      "context",
      "market_context",
      "marketContext",
      "recent_events",
      "recentEvents",
    ]);
    const expandedSources = contextBadgeSource ? [source, contextBadgeSource] : [source];

    for (const expandedSource of expandedSources) {
      pushCount(
        "External news",
        getUnknownValue(expandedSource, [
          "recent_external_news_count",
          "external_news_count",
          "news_count",
          "recent_news_count",
        ]),
      );
      pushText(
        "External news",
        getStringValue(expandedSource, ["recent_external_news_status", "external_news_status", "news_status"]),
      );
      pushCount(
        "DART events",
        getUnknownValue(expandedSource, [
          "recent_dart_events_count",
          "dart_events_count",
          "dart_event_count",
          "recent_disclosure_count",
        ]),
      );
      pushText(
        "DART events",
        getStringValue(expandedSource, ["recent_dart_events_status", "dart_events_status", "dart_status", "disclosure_status"]),
      );
      pushText(
        "Investor flow",
        getStringValue(expandedSource, ["investor_flow_context", "investor_flow", "flow_context", "investor_context"]),
      );
      pushText(
        "Sector context",
        getStringValue(expandedSource, ["sector_context", "sector_flow_context", "industry_context", "sector_summary"]),
      );
    }
  }

  return entries.filter(
    (entry, index, all) =>
      all.findIndex((candidate) => candidate.label === entry.label && candidate.value === entry.value) === index,
  );
}

function compareSignalDeciderItems(left: SignalDeciderFeedbackItem, right: SignalDeciderFeedbackItem) {
  const priority: Record<SignalDeciderAction, number> = {
    buy: 0,
    watch_for_trigger: 1,
    avoid_chase: 2,
    reject: 3,
    wait: 4,
    unknown: 5,
  };
  const leftPriority = priority[left.action];
  const rightPriority = priority[right.action];
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  const leftScore = left.convictionScore ?? left.confidenceScore ?? Number.NEGATIVE_INFINITY;
  const rightScore = right.convictionScore ?? right.confidenceScore ?? Number.NEGATIVE_INFINITY;
  if (leftScore !== rightScore) return rightScore - leftScore;

  return left.symbol.localeCompare(right.symbol, "en");
}

export function buildSignalDeciderFeedbackPath({
  basePath,
  limit = SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  marketDate,
}: {
  basePath: string;
  limit?: number | null;
  marketDate: string;
}) {
  return buildDeciderFeedbackPath({
    agentName: SIGNAL_DECIDER_AGENT_NAME,
    basePath,
    limit,
    marketDate,
  });
}

export function buildDeciderFeedbackPath({
  agentName = SIGNAL_DECIDER_AGENT_NAME,
  basePath,
  limit = SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  marketDate,
}: {
  agentName?: string | null;
  basePath: string;
  limit?: number | null;
  marketDate: string;
}) {
  const params = new URLSearchParams({
    market_date: marketDate,
    agent_name: resolveDeciderAgentName(agentName),
    limit: String(limit ?? SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT),
  });
  return `${basePath}?${params.toString()}`;
}

export function buildSignalDeciderLatestFeedbackPath({
  basePath,
  limit = SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  marketDate,
}: {
  basePath: string;
  limit?: number | null;
  marketDate: string | null | undefined;
}) {
  return buildDeciderLatestFeedbackPath({
    agentName: SIGNAL_DECIDER_AGENT_NAME,
    basePath,
    limit,
    marketDate,
  });
}

export function buildDeciderLatestFeedbackPath({
  agentName = SIGNAL_DECIDER_AGENT_NAME,
  basePath,
  limit = SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT,
  marketDate,
}: {
  agentName?: string | null;
  basePath: string;
  limit?: number | null;
  marketDate: string | null | undefined;
}) {
  const resolvedMarketDate = normalizeMarketDate(marketDate);
  if (!resolvedMarketDate) return null;

  return buildDeciderFeedbackPath({
    agentName,
    basePath,
    limit,
    marketDate: resolvedMarketDate,
  });
}

export function resolveSignalDeciderLatestFeedbackMarketDate({
  currentMarketDate,
  latestCompletedMarketDate,
  progressMarketDate,
  resolvedProcessMarketDate,
}: {
  currentMarketDate: string | null | undefined;
  latestCompletedMarketDate?: string | null | undefined;
  progressMarketDate: string | null | undefined;
  resolvedProcessMarketDate: string | null | undefined;
}) {
  const normalizedCurrentMarketDate = normalizeMarketDate(currentMarketDate);
  const resolvedCandidates = [
    latestCompletedMarketDate,
    resolvedProcessMarketDate,
    progressMarketDate,
  ].map(normalizeMarketDate);

  const fallbackMarketDate = resolvedCandidates.find(
    (candidate) => candidate && candidate !== normalizedCurrentMarketDate,
  );
  if (fallbackMarketDate) return fallbackMarketDate;

  const resolvedMarketDate = resolvedCandidates.find((candidate) => candidate);
  if (resolvedMarketDate) return resolvedMarketDate;

  return normalizedCurrentMarketDate;
}

export function buildSignalDeciderFeedbackHref(marketDate: string | null | undefined) {
  if (!hasTextValue(marketDate)) return SIGNAL_DECIDER_FEEDBACK_DASHBOARD_PATH;
  const params = new URLSearchParams({ marketDate: marketDate.trim() });
  return `${SIGNAL_DECIDER_FEEDBACK_DASHBOARD_PATH}?${params.toString()}`;
}

export function buildDeciderFeedbackHref({
  agentName = SIGNAL_DECIDER_AGENT_NAME,
  marketDate,
  query,
  actionFilter,
  gapCategory,
  gapSymbol,
  statusFilter,
  sortMode,
}: {
  agentName?: string | null;
  marketDate?: string | null;
  query?: string | null;
  actionFilter?: string | null;
  gapCategory?: string | null;
  gapSymbol?: string | null;
  statusFilter?: string | null;
  sortMode?: string | null;
} = {}) {
  const params = new URLSearchParams({ agent: resolveDeciderAgentName(agentName) });
  if (hasTextValue(marketDate)) params.set("marketDate", marketDate.trim());
  if (hasTextValue(query)) params.set("q", query.trim());
  if (hasTextValue(actionFilter) && actionFilter !== "all") params.set("feedbackAction", actionFilter.trim());
  if (hasTextValue(gapCategory) && gapCategory !== "all") params.set("gapCategory", gapCategory.trim());
  if (hasTextValue(gapSymbol) && gapSymbol !== "all") params.set("gapSymbol", gapSymbol.trim());
  if (hasTextValue(statusFilter) && statusFilter !== "all") params.set("feedbackStatus", statusFilter.trim());
  if (hasTextValue(sortMode) && sortMode !== "priority") params.set("feedbackSort", sortMode.trim());
  return `${DECIDER_FEEDBACK_DASHBOARD_PATH}?${params.toString()}`;
}

export function normalizeDeciderFeedbackItems(
  response: AgentFeedbackListResponseDto | null | undefined,
  {
    agentName,
    evaluationReferenceDate,
  }: {
    agentName?: string | null;
    evaluationReferenceDate?: string | null;
  } = {},
): SignalDeciderFeedbackItem[] {
  const items = response?.items ?? [];
  const resolvedAgentName = resolveDeciderAgentName(agentName ?? response?.request?.agent_name);

  return items
    .map((item) => {
      const payload = getPayload(item);
      const symbol = getStringValue(payload, ["symbol"]) ?? item.symbol;
      const itemAgentName = resolveDeciderAgentName(item.agent.name ?? payload.agent_name ?? payload.role ?? resolvedAgentName);
      const { action, nextDayOpenAction, preferredAction } = resolveDecisionActions(payload);
      const context = isRecord(item.context) ? item.context : null;
      const details = isRecord(payload.details) ? payload.details : null;
      const itemDetails = isRecord(item.details) ? item.details : null;
      const decisionSupport = getRecordValue(details, ["decision_support", "decisionSupport"]);
      const rawFeedback = isRecord(item.feedback) ? item.feedback : null;
      const rawFeedbackDetails =
        rawFeedback && rawFeedback !== payload && isRecord(rawFeedback.details) ? rawFeedback.details : null;
      const rawFeedbackDecisionSupport = getRecordValue(rawFeedbackDetails, ["decision_support", "decisionSupport"]);
      const payloadTraceability = isRecord(payload.traceability) ? payload.traceability : null;
      const rootSources = [payload, details, decisionSupport, itemDetails];
      const rawFeedbackSources =
        rawFeedback && rawFeedback !== payload ? [rawFeedback, rawFeedbackDetails, rawFeedbackDecisionSupport] : [];
      const evaluationRecord = getFirstRecordFromSources(rootSources, [
        "evaluation",
        "evaluation_summary",
        "decision_evaluation",
        "decision_quality",
        "quality",
      ]);
      const outcomeRecord = getFirstRecordFromSources(rootSources, [
        "outcome",
        "outcome_summary",
        "realized_outcome",
        "realized_result",
      ]);
      const rawFeedbackEvaluationRecord = getFirstRecordFromSources(rawFeedbackSources, [
        "evaluation",
        "evaluation_summary",
        "decision_evaluation",
        "decision_quality",
        "quality",
      ]);
      const rawFeedbackOutcomeRecord = getFirstRecordFromSources(rawFeedbackSources, [
        "outcome",
        "outcome_summary",
        "realized_outcome",
        "realized_result",
      ]);
      const shortTermRecord = getFirstRecordFromSources(rootSources, [
        "short_term",
        "short_term_decision",
        "tactical_decision",
        "tactical",
        "trigger_plan",
        "trade_plan",
      ]);
      const policyRecord = getFirstRecordFromSources(rootSources, ["policy", "decision_policy", "ruleset"]);
      const marketDate =
        normalizeMarketDate(getStringValue(payload, ["market_date"])) ??
        normalizeMarketDate(item.market_date) ??
        response?.request?.market_date ??
        "";
      const qualitySources = [...rootSources, shortTermRecord, evaluationRecord, outcomeRecord];
      const quality = normalizeQualityTag({ action, sources: qualitySources });
      const fiveDayEvaluation = normalizeFiveDayEvaluation({
        evaluationReferenceDate,
        marketDate,
        sources: [
          ...rootSources,
          shortTermRecord,
          evaluationRecord,
          outcomeRecord,
          ...rawFeedbackSources,
          rawFeedbackEvaluationRecord,
          rawFeedbackOutcomeRecord,
        ],
      });
      const horizonSourceRecords = [
        ...rootSources,
        shortTermRecord,
        evaluationRecord,
        outcomeRecord,
        ...rawFeedbackSources,
        rawFeedbackEvaluationRecord,
        rawFeedbackOutcomeRecord,
      ];
      const outcomeHorizons = getValuesFromSources(horizonSourceRecords, [
        "realized_results",
        "realized_outcomes",
        "outcome_horizons",
        "outcomes",
        "horizon_results",
        "result_by_horizon",
        "horizons",
        "results",
      ]).flatMap(normalizeOutcomeHorizons);
      const horizonEvaluationCandidates = getValuesFromSources(horizonSourceRecords, [
        "horizon_evaluations",
        "review_horizons",
        "realized_results",
        "realized_outcomes",
        "outcome_horizons",
        "outcomes",
        "horizon_results",
        "result_by_horizon",
        "horizons",
        "results",
      ]).flatMap(normalizeHorizonEvaluations);
      const horizonEvaluations = buildHorizonEvaluations({
        candidates: horizonEvaluationCandidates,
        fiveDayEvaluation,
      });
      const pathOutcome = normalizePathOutcome([...rootSources, shortTermRecord, evaluationRecord, outcomeRecord]);
      const intradayPathResult = getStringFromSources([...rootSources, shortTermRecord, evaluationRecord, outcomeRecord], [
        "intraday_path_result",
        "intraday_result",
        "intraday_path_summary",
        "path_summary",
        "target_stop_result",
        "target_stop_outcome",
      ]);
      const reviewConclusion = resolveReviewConclusion({
        action,
        outcomeHorizons,
        pathOutcome,
        qualityTag: quality.qualityTag,
        sources: [...rootSources, shortTermRecord, evaluationRecord, outcomeRecord],
      });
      const factorAttributions = getValuesFromSources([...rootSources, shortTermRecord, evaluationRecord], [
        "factors",
        "factor_attribution",
        "factor_attributions",
        "factor_scores",
        "factor_contributions",
        "attribution",
      ]).flatMap(normalizeTraceEntries);
      const gateResults = getValuesFromSources([...rootSources, shortTermRecord, evaluationRecord], [
        "gates",
        "gate_results",
        "gate_checks",
        "decision_gates",
        "failed_gates",
        "passed_gates",
      ]).flatMap(normalizeTraceEntries);
      const supportingEvidence = getValuesFromSources([...rootSources, shortTermRecord], [
        "supporting_evidence_snippets",
        "evidence_snippets",
        "thesis_evidence",
        "supporting_evidence",
        "evidence",
      ]).flatMap(normalizeTraceEntries);
      const upstreamEvidence = getValuesFromSources(rootSources, [
        "upstream_evidence",
        "supporting_evidence",
        "evidence",
        "references",
        "source_evidence",
      ]).flatMap(normalizeTraceEntries);
      const traceability = getValuesFromSources([...rootSources, shortTermRecord, payloadTraceability], [
        "traceability",
        "trace",
        "decision_trace",
        "lineage",
      ]).flatMap(normalizeTraceEntries);
      const planSources = [payload, shortTermRecord, details, decisionSupport, itemDetails];
      return {
        id: String(item.id),
        agentName: itemAgentName,
        symbol,
        companyName:
          getStringValue(payload, ["company_name", "companyName", "name_ko", "name"]) ??
          getContextCompanyName(symbol, context),
        marketDate,
        runId: item.agent.run_id ?? null,
        agentVersion: item.agent.version ?? null,
        action,
        actionLabel: formatSignalDeciderActionLabel(action),
        preferredAction,
        preferredActionLabel: formatSignalDeciderActionLabel(preferredAction),
        nextDayOpenAction,
        nextDayOpenActionLabel: formatSignalDeciderActionLabel(nextDayOpenAction),
        confidenceScore: normalizeScore10(payload.confidence_score_10 ?? payload.confidence),
        convictionScore: normalizeScore10(payload.conviction_score_10),
        thesisSummary:
          getStringFromSources(planSources, [
            "thesis_summary",
            "short_term_thesis",
            "short_term_thesis_summary",
            "tactical_thesis",
            "summary",
          ]),
        supportingEvidence,
        riskFlags: getRiskFlags(payload),
        dataGapFlags: getDataGapFlags([
          ...planSources,
          evaluationRecord,
          outcomeRecord,
          context,
          context ? getRecordValue(context, ["symbol_day_context", "symbolDayContext"]) : null,
        ]),
        targetPrice: toFiniteNumber(
          payload.target_price ??
            payload.target ??
            shortTermRecord?.target_price ??
            shortTermRecord?.target ??
            decisionSupport?.target_price,
        ),
        stopLossPrice: toFiniteNumber(
          payload.stop_loss_price ??
            payload.stop_price ??
            payload.stop ??
            shortTermRecord?.stop_loss_price ??
            shortTermRecord?.stop_price ??
            shortTermRecord?.stop ??
            decisionSupport?.stop_loss_price,
        ),
        expectedReturnPct: toFiniteNumber(payload.expected_return_pct ?? decisionSupport?.expected_return_pct),
        entryPriceBasis:
          getStringFromSources(planSources, [
            "entry_price_basis",
            "entry_basis",
            "price_basis",
            "entry_price",
            "entry_level",
          ]),
        triggerCondition:
          getStringFromSources(planSources, [
            "trigger_condition",
            "trigger",
            "entry_trigger",
            "buy_trigger",
            "trigger_plan",
            "activation_condition",
          ]),
        entryCondition:
          getStringFromSources(planSources, [
            "entry_condition",
            "entry_plan",
            "entry_criteria",
            "entry_rule",
            "next_open_entry_condition",
          ]),
        invalidationCondition:
          getStringFromSources(planSources, [
            "invalidation_condition",
            "invalidation",
            "invalidated_if",
            "exit_invalidation",
            "thesis_invalidation",
          ]),
        suggestedHoldingPeriod:
          getStringFromSources(planSources, [
            "suggested_holding_period",
            "holding_period",
            "expected_holding_period",
            "time_horizon",
          ]),
        contextBadges: normalizeContextBadgeEntries([...planSources, context ? getRecordValue(context, ["symbol_day_context", "symbolDayContext"]) : null]),
        policyVersion:
          getStringFromSources(rootSources, [
            "policy_version",
            "policyVersion",
            "decision_policy_version",
            "ruleset_version",
            "rule_bundle_version",
          ]) ??
          getStringValue(policyRecord, ["version"]) ??
          null,
        qualityVerdict: quality.qualityVerdict,
        qualityReason: quality.qualityReason,
        qualityTag: quality.qualityTag,
        reviewConclusion,
        pathOutcome,
        intradayPathResult,
        fiveDayEvaluation,
        outcomeHorizons,
        horizonEvaluations,
        factorAttributions,
        gateResults,
        upstreamEvidence,
        traceability,
        capturedAt:
          getStringValue(payload, ["captured_at", "created_at", "completed_at"]) ??
          getStringValue(payloadTraceability, ["captured_at", "completed_at"]),
        receivedAt: item.received_at,
      };
    })
    .sort(compareSignalDeciderItems);
}

export function normalizeSignalDeciderFeedbackItems(
  response: AgentFeedbackListResponseDto | null | undefined,
  options: {
    evaluationReferenceDate?: string | null;
  } = {},
): SignalDeciderFeedbackItem[] {
  return normalizeDeciderFeedbackItems(response, {
    agentName: SIGNAL_DECIDER_AGENT_NAME,
    evaluationReferenceDate: options.evaluationReferenceDate,
  });
}

export function compactSignalDeciderFeedbackForDashboard(
  feedback: AgentFeedbackListResponseDto | null | undefined,
): AgentFeedbackListResponseDto | null {
  if (!feedback) return null;

  const compactItems = normalizeSignalDeciderFeedbackItems(feedback).map((item) => {
    return {
      id: item.id,
      market_date: item.marketDate,
      symbol: item.symbol,
      agent: {
        name: SIGNAL_DECIDER_AGENT_NAME,
        version: item.agentVersion,
        run_id: item.runId,
      },
      summary: {
        quality_tag: item.qualityTag,
      },
      feedback: {
        symbol: item.symbol,
        market_date: item.marketDate,
        preferred_action: item.preferredAction,
        next_day_open_action: item.nextDayOpenAction,
        confidence_score_10: item.confidenceScore,
        conviction_score_10: item.convictionScore,
        thesis_summary: item.thesisSummary,
        risk_flags: item.riskFlags,
        target_price: item.targetPrice,
        stop_loss_price: item.stopLossPrice,
        expected_return_pct: item.expectedReturnPct,
        company_name: item.companyName,
        entry_price_basis: item.entryPriceBasis,
        suggested_holding_period: item.suggestedHoldingPeriod,
        policy_version: item.policyVersion,
        quality_verdict: item.qualityVerdict,
        quality_reason: item.qualityReason,
        five_day_evaluation: item.fiveDayEvaluation,
        horizon_evaluations: item.horizonEvaluations,
      },
      normalized_feedback: null,
      details: null,
      context: {
        symbol_day_context: {
          company: {
            name: item.companyName,
          },
        },
      },
      received_at: item.receivedAt,
    } satisfies AgentFeedbackStoredItemDto;
  });

  return {
    ...feedback,
    request: {
      ...feedback.request,
      symbols: compactItems.map((item) => item.symbol),
    },
    summary: {
      ...feedback.summary,
      count: feedback.summary.count,
    },
    items: compactItems,
  };
}

function getDeciderRoleSnapshot(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
  agentName: string | null | undefined = SIGNAL_DECIDER_AGENT_NAME,
): SignalDeciderRoleSnapshot | null {
  const roles = progress?.result?.roles;
  if (!roles) return null;
  const resolvedAgentName = resolveDeciderAgentName(agentName);

  const readSnapshot = (value: unknown): SignalDeciderRoleSnapshot | null => {
    if (!isRecord(value)) return null;
    return {
      requestedCount: toFiniteNumber(value.requested_count ?? value.requestedCount),
      completedCount: toFiniteNumber(value.completed_count ?? value.completedCount),
      errorCount: toFiniteNumber(value.error_count ?? value.errorCount),
    };
  };

  if (Array.isArray(roles)) {
    for (const item of roles) {
      if (!isRecord(item)) continue;
      const role = getStringValue(item, ["role", "agent", "name", "label"]);
      if (normalizeRole(role) === resolvedAgentName) return readSnapshot(item);
    }
    return null;
  }

  if (!isRecord(roles)) return null;
  return readSnapshot(roles[resolvedAgentName]);
}

export function resolveSignalDeciderFeedbackResultLimit(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
) {
  return resolveDeciderFeedbackResultLimit(progress, SIGNAL_DECIDER_AGENT_NAME);
}

export function resolveDeciderFeedbackResultLimit(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
  agentName: string | null | undefined = SIGNAL_DECIDER_AGENT_NAME,
) {
  const roleSnapshot = getDeciderRoleSnapshot(progress, agentName);
  const requestedLimit = Math.max(roleSnapshot?.completedCount ?? 0, roleSnapshot?.requestedCount ?? 0);
  if (requestedLimit <= 0) return SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT;
  return Math.min(SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT, Math.ceil(requestedLimit));
}

function getDeciderRoleProgressStatus(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
  agentName: string | null | undefined = SIGNAL_DECIDER_AGENT_NAME,
) {
  const progressRecord = isRecord(progress) ? (progress as Record<string, unknown>) : null;
  const summaryRecord = isRecord(progressRecord?.summary)
    ? (progressRecord.summary as Record<string, unknown>)
    : null;
  const resolvedAgentName = resolveDeciderAgentName(agentName);
  const sources = [
    progressRecord?.role_progress,
    progressRecord?.roles,
    summaryRecord?.role_progress,
    summaryRecord?.roles,
    summaryRecord?.role_statuses,
  ];

  for (const source of sources) {
    const candidate = Array.isArray(source)
      ? source.find((item) => isRecord(item) && normalizeRole(getStringValue(item, ["role", "agent", "name", "label"])) === resolvedAgentName)
      : isRecord(source)
        ? source[resolvedAgentName]
        : null;

    if (!isRecord(candidate)) continue;
    const status = getStringValue(candidate, ["boundary_status", "status", "run_status", "role_status", "progress_status"]);
    if (status) return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  return null;
}

function normalizeRunStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : null;
}

export function resolveSignalDeciderFeedbackStatus({
  feedback,
  progress,
}: {
  feedback: AgentFeedbackListResponseDto | null | undefined;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
}): SignalDeciderFeedbackStatus {
  return resolveDeciderFeedbackStatus({ agentName: SIGNAL_DECIDER_AGENT_NAME, feedback, progress });
}

export function resolveDeciderFeedbackStatus({
  agentName = SIGNAL_DECIDER_AGENT_NAME,
  feedback,
  progress,
}: {
  agentName?: string | null;
  feedback: AgentFeedbackListResponseDto | null | undefined;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
}): SignalDeciderFeedbackStatus {
  const resolvedAgentName = resolveDeciderAgentName(agentName);
  const items = normalizeDeciderFeedbackItems(feedback, { agentName: resolvedAgentName });
  const rowCount = items.length;
  const roleSnapshot = getDeciderRoleSnapshot(progress, resolvedAgentName);
  const roleProgressStatus = getDeciderRoleProgressStatus(progress, resolvedAgentName);
  const runStatus = normalizeRunStatus(progress?.summary?.run_status);
  const runTableStatus = normalizeRunStatus(progress?.summary?.run_table_status);
  const cycleStatus = normalizeRunStatus(progress?.summary?.cycle_status);
  const currentRole = normalizeRole(progress?.summary?.current_role);
  const remainingRoles = Array.isArray(progress?.summary?.remaining_roles)
    ? progress.summary.remaining_roles.map((role) => normalizeRole(role))
    : [];
  const completedCount = roleSnapshot?.completedCount ?? rowCount;
  const requestedCount = roleSnapshot?.requestedCount ?? null;
  const errorCount = roleSnapshot?.errorCount ?? null;
  const isRunActive =
    progress?.summary?.is_live === true ||
    runStatus === "running" ||
    runTableStatus === "running" ||
    cycleStatus === "running";
  const isSignalRoleActive =
    currentRole === resolvedAgentName ||
    remainingRoles.includes(resolvedAgentName) ||
    roleProgressStatus === "running" ||
    roleProgressStatus === "in_progress" ||
    roleProgressStatus === "processing";

  if (isRunActive && isSignalRoleActive) return "running";

  if (
    runStatus === "stalled" ||
    runStatus === "failed" ||
    runTableStatus === "stalled" ||
    runTableStatus === "failed" ||
    cycleStatus === "stalled" ||
    cycleStatus === "failed" ||
    roleProgressStatus === "failed" ||
    roleProgressStatus === "error" ||
    roleProgressStatus === "needs_review" ||
    (errorCount !== null && errorCount > 0)
  ) {
    return "needs-review";
  }

  if (
    roleProgressStatus === "partial" ||
    roleProgressStatus === "completed_with_failures" ||
    runStatus === "partial" ||
    runTableStatus === "partial" ||
    cycleStatus === "partial" ||
    (rowCount > 0 && requestedCount !== null && completedCount < requestedCount)
  ) {
    return "partial";
  }

  if (rowCount > 0 && (requestedCount === null || completedCount >= requestedCount)) return "completed";
  return "waiting";
}

function getSignalDeciderFeedbackResponseMarketDate(
  feedback: AgentFeedbackListResponseDto | null | undefined,
) {
  return (
    normalizeMarketDate(feedback?.request?.market_date) ??
    normalizeMarketDate(feedback?.items?.[0]?.market_date) ??
    null
  );
}

function getSignalDeciderStoredItemMarketDate(item: AgentFeedbackStoredItemDto) {
  return normalizeMarketDate(item.market_date) ?? normalizeMarketDate(item.feedback?.market_date) ?? null;
}

function hasSignalDeciderFeedbackRows(feedback: AgentFeedbackListResponseDto | null | undefined) {
  return normalizeSignalDeciderFeedbackItems(feedback).length > 0;
}

function cloneSignalDeciderFeedbackForMarketDate(
  feedback: AgentFeedbackListResponseDto | null | undefined,
  marketDate: string,
): AgentFeedbackListResponseDto | null {
  if (!feedback) return null;
  const items = (feedback.items ?? []).filter((item) => getSignalDeciderStoredItemMarketDate(item) === marketDate);
  if (items.length <= 0) return null;

  return {
    ...feedback,
    request: {
      ...feedback.request,
      market_date: marketDate,
    },
    summary: {
      ...feedback.summary,
      count: items.length,
    },
    items,
  };
}

function selectLatestCompletedSignalDeciderFeedback(
  feedback: AgentFeedbackListResponseDto | null | undefined,
  currentMarketDate: string | null,
) {
  if (!feedback) return null;

  const candidateDates = new Set<string>();
  const responseMarketDate = getSignalDeciderFeedbackResponseMarketDate(feedback);
  if (responseMarketDate) candidateDates.add(responseMarketDate);
  for (const item of feedback.items ?? []) {
    const itemMarketDate = getSignalDeciderStoredItemMarketDate(item);
    if (itemMarketDate) candidateDates.add(itemMarketDate);
  }

  const sortedDates = [...candidateDates].sort((left, right) => right.localeCompare(left));
  for (const marketDate of sortedDates) {
    if (marketDate === currentMarketDate) continue;
    const marketDateFeedback = cloneSignalDeciderFeedbackForMarketDate(feedback, marketDate);
    if (hasSignalDeciderFeedbackRows(marketDateFeedback)) return marketDateFeedback;
  }

  return null;
}

function isCurrentSignalDeciderFeedbackComplete({
  currentMarketDate,
  feedback,
  progress,
}: {
  currentMarketDate: string | null;
  feedback: AgentFeedbackListResponseDto | null | undefined;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
}) {
  const feedbackMarketDate = getSignalDeciderFeedbackResponseMarketDate(feedback);
  if (!currentMarketDate || feedbackMarketDate !== currentMarketDate || !hasSignalDeciderFeedbackRows(feedback)) {
    return false;
  }

  const status = resolveSignalDeciderFeedbackStatus({ feedback, progress });
  return status === "completed" || status === "needs-review";
}

export function selectSignalDeciderDashboardFeedback({
  currentFeedback,
  currentMarketDate,
  latestCompletedFeedback,
  progress,
}: {
  currentFeedback: AgentFeedbackListResponseDto | null | undefined;
  currentMarketDate: string | null | undefined;
  latestCompletedFeedback: AgentFeedbackListResponseDto | null | undefined;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
}): SignalDeciderDashboardFeedbackSelection {
  const normalizedCurrentMarketDate =
    normalizeMarketDate(currentMarketDate) ?? normalizeMarketDate(progress?.request?.market_date);
  const currentFeedbackMarketDate = getSignalDeciderFeedbackResponseMarketDate(currentFeedback);
  const currentDateFeedback =
    normalizedCurrentMarketDate && currentFeedbackMarketDate === normalizedCurrentMarketDate
      ? (currentFeedback ?? null)
      : null;

  if (
    isCurrentSignalDeciderFeedbackComplete({
      currentMarketDate: normalizedCurrentMarketDate,
      feedback: currentDateFeedback,
      progress,
    })
  ) {
    return {
      currentMarketDate: normalizedCurrentMarketDate,
      feedback: currentDateFeedback,
      isLatestCompletedFallback: false,
    };
  }

  const currentFeedbackDate = getSignalDeciderFeedbackResponseMarketDate(currentFeedback);
  if (
    currentFeedbackDate &&
    currentFeedbackDate !== normalizedCurrentMarketDate &&
    hasSignalDeciderFeedbackRows(currentFeedback)
  ) {
    return {
      currentMarketDate: normalizedCurrentMarketDate,
      feedback: currentFeedback ?? null,
      isLatestCompletedFallback: true,
    };
  }

  const latestCompletedDateFeedback = selectLatestCompletedSignalDeciderFeedback(
    latestCompletedFeedback,
    normalizedCurrentMarketDate,
  );
  if (latestCompletedDateFeedback) {
    return {
      currentMarketDate: normalizedCurrentMarketDate,
      feedback: latestCompletedDateFeedback,
      isLatestCompletedFallback: true,
    };
  }

  return {
    currentMarketDate: normalizedCurrentMarketDate,
    feedback: currentDateFeedback,
    isLatestCompletedFallback: false,
  };
}

function getComparableActionGroup(action: SignalDeciderAction) {
  if (action === "buy") return "buy";
  if (action === "reject" || action === "avoid_chase") return "reject";
  if (action === "wait" || action === "watch_for_trigger") return "wait";
  return "unknown";
}

function getComparisonScore(item: SignalDeciderFeedbackItem) {
  return item.convictionScore ?? item.confidenceScore;
}

function getContrastSnippet(item: SignalDeciderFeedbackItem) {
  return item.thesisSummary ?? item.supportingEvidence[0]?.value ?? item.supportingEvidence[0]?.label ?? null;
}

function getRiskContrastSnippet(item: SignalDeciderFeedbackItem) {
  return item.riskFlags[0] ?? item.dataGapFlags[0] ?? null;
}

export function getDeciderFeedbackComparisonKey(item: Pick<SignalDeciderFeedbackItem, "marketDate" | "symbol">) {
  return `${item.marketDate}:${item.symbol}`;
}

export function buildDeciderFeedbackComparisons({
  shortTermItems,
  signalItems,
}: {
  shortTermItems: SignalDeciderFeedbackItem[];
  signalItems: SignalDeciderFeedbackItem[];
}): DeciderFeedbackComparison[] {
  const signalByKey = new Map(signalItems.map((item) => [getDeciderFeedbackComparisonKey(item), item] as const));

  return shortTermItems
    .map((shortTermItem) => {
      const signalItem = signalByKey.get(getDeciderFeedbackComparisonKey(shortTermItem));
      if (!signalItem) return null;

      const shortTermScore = getComparisonScore(shortTermItem);
      const signalScore = getComparisonScore(signalItem);
      const shortTermGroup = getComparableActionGroup(shortTermItem.action);
      const signalGroup = getComparableActionGroup(signalItem.action);
      const agreement =
        shortTermGroup === "unknown" || signalGroup === "unknown"
          ? "unknown"
          : shortTermGroup === signalGroup
            ? "agreement"
            : "disagreement";
      const shortReason = getContrastSnippet(shortTermItem);
      const signalReason = getContrastSnippet(signalItem);
      const shortRisk = getRiskContrastSnippet(shortTermItem);
      const signalRisk = getRiskContrastSnippet(signalItem);

      return {
        symbol: shortTermItem.symbol,
        marketDate: shortTermItem.marketDate,
        shortTermAction: shortTermItem.action,
        shortTermActionLabel: shortTermItem.actionLabel,
        signalAction: signalItem.action,
        signalActionLabel: signalItem.actionLabel,
        agreement,
        confidenceDelta: shortTermScore !== null && signalScore !== null ? shortTermScore - signalScore : null,
        reasonContrast:
          shortReason || signalReason ? `Short-term: ${shortReason ?? "n/a"} · Signal: ${signalReason ?? "n/a"}` : null,
        riskContrast:
          shortRisk || signalRisk ? `Short-term risk: ${shortRisk ?? "n/a"} · Signal risk: ${signalRisk ?? "n/a"}` : null,
      } satisfies DeciderFeedbackComparison;
    })
    .filter((item): item is DeciderFeedbackComparison => item !== null);
}

const DATA_GAP_HINT_PATTERN =
  /\b(absent|anomalous|anomaly|cannot|can't|gap|incomplete|insufficient|invalid|lack|lacks|missing|not available|not present|stale|unavailable|unknown|without)\b|누락|부재|부족|없음|없고|없는|미제공|불가|불충분|이상|품질/;

const DECIDER_DATA_GAP_CATEGORY_PATTERNS: Record<Exclude<DeciderDataGapCategory, "other">, RegExp[]> = {
  factor_scores: [
    /factor[\s_-]*(score|scores|rank|ranking|scoring|attribution|attributions)/,
    /(score|scores)[\s_-]*factor/,
    /팩터|요인\s*점수/,
  ],
  turnover_liquidity: [
    /turnover|liquidity|volume|trade[\s_-]*value|거래대금|거래량|유동성|수급/,
  ],
  signal_features: [
    /signal[\s_-]*features?|feature[\s_-]*snapshot|features?[\s_-]*snapshot|시그널\s*특징/,
  ],
  intraday_orderbook: [
    /intraday|intra[\s_-]*day|order[\s_-]*book|orderbook|vwap|bid[\s_-]*ask|opening[\s_-]*range|호가|장중/,
  ],
  fundamental_ratios: [
    /fundamental[\s_-]*(ratio|ratios|metric|metrics)|valuation|per\b|pbr\b|roe\b|eps\b|bps\b|ebitda|밸류에이션|재무\s*비율/,
  ],
  dart_disclosures: [
    /\bdart\b|disclosure|disclosures|filing|filings|공시/,
  ],
  external_news: [
    /external[\s_-]*news|\bnews\b|뉴스|기사/,
  ],
  price_quality: [
    /price|quote|ohlc|candle|bar|daily[\s_-]*bar|follow[\s_-]*up[\s_-]*bars?|adjusted|trade[\s_-]*date|replay[\s_-]*bar|가격|시세|캔들/,
  ],
};

function getCategoryRank(category: DeciderDataGapCategory) {
  const index = DECIDER_DATA_GAP_CATEGORIES.indexOf(category);
  return index >= 0 ? index : DECIDER_DATA_GAP_CATEGORIES.length;
}

function normalizeGapSearchText(value: string) {
  return `${value.trim().toLowerCase()} ${normalizeToken(value)}`;
}

function getDataGapCategoriesForText(text: string, source: "structured" | "narrative"): DeciderDataGapCategory[] {
  const searchable = normalizeGapSearchText(text);
  const matchedCategories = (Object.entries(DECIDER_DATA_GAP_CATEGORY_PATTERNS) as Array<
    [Exclude<DeciderDataGapCategory, "other">, RegExp[]]
  >)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(searchable)))
    .map(([category]) => category);
  const hasGapHint = source === "structured" || DATA_GAP_HINT_PATTERN.test(searchable);

  if (matchedCategories.length > 0 && hasGapHint) return matchedCategories;
  if (source === "structured" && hasGapHint) return ["other"];
  return [];
}

function getTraceEntryText(entry: SignalDeciderTraceEntry) {
  return [entry.label, entry.value, entry.value ? `${entry.label}: ${entry.value}` : null].filter(
    (value): value is string => hasTextValue(value),
  );
}

function getDeciderDataGapCandidates(item: SignalDeciderFeedbackItem) {
  const structured = [
    ...item.dataGapFlags,
    ...item.fiveDayEvaluation.dataQualityWarnings,
  ];
  const narrative = [
    ...item.riskFlags,
    item.qualityReason,
    item.reviewConclusion,
    item.pathOutcome?.detail,
    item.intradayPathResult,
    item.thesisSummary,
    ...item.supportingEvidence.flatMap(getTraceEntryText),
    ...item.contextBadges.flatMap(getTraceEntryText),
    ...item.factorAttributions.flatMap(getTraceEntryText),
    ...item.gateResults.flatMap(getTraceEntryText),
    ...item.upstreamEvidence.flatMap(getTraceEntryText),
    ...item.traceability.flatMap(getTraceEntryText),
    ...item.outcomeHorizons.flatMap((outcome) => [
      outcome.verdict,
      outcome.notes,
    ]),
  ];

  return [
    ...structured.map((text) => ({ source: "structured" as const, text })),
    ...narrative.map((text) => ({ source: "narrative" as const, text })),
  ].filter((candidate): candidate is { source: "structured" | "narrative"; text: string } =>
    hasTextValue(candidate.text),
  );
}

function buildDeciderDataGapRecords(items: SignalDeciderFeedbackItem[]) {
  const recordsByKey = new Map<string, DeciderDataGapRecord>();

  for (const item of items) {
    for (const candidate of getDeciderDataGapCandidates(item)) {
      const categories = getDataGapCategoriesForText(candidate.text, candidate.source);
      for (const category of categories) {
        const key = `${item.id}:${category}`;
        if (recordsByKey.has(key)) continue;
        recordsByKey.set(key, {
          agentName: item.agentName,
          category,
          companyName: item.companyName,
          example: candidate.text,
          itemId: item.id,
          marketDate: item.marketDate,
          symbol: item.symbol,
        });
      }
    }
  }

  return [...recordsByKey.values()].sort((left, right) => {
    const categoryRank = getCategoryRank(left.category) - getCategoryRank(right.category);
    if (categoryRank !== 0) return categoryRank;
    const symbolRank = left.symbol.localeCompare(right.symbol, "en");
    if (symbolRank !== 0) return symbolRank;
    return left.agentName.localeCompare(right.agentName, "en");
  });
}

function uniqueSortedValues(values: string[]) {
  return [...new Set(values.filter(hasTextValue))].sort((left, right) => left.localeCompare(right, "en"));
}

function uniqueExamples(values: string[], limit = 3) {
  return [...new Set(values.filter(hasTextValue))].slice(0, limit);
}

export function buildDeciderDataGapCategorySummaries(records: DeciderDataGapRecord[]) {
  return DECIDER_DATA_GAP_CATEGORIES.map((category) => {
    const categoryRecords = records.filter((record) => record.category === category);
    if (categoryRecords.length <= 0) return null;

    return {
      affectedAgentCount: uniqueSortedValues(categoryRecords.map((record) => record.agentName)).length,
      affectedAgents: uniqueSortedValues(categoryRecords.map((record) => record.agentName)),
      affectedSymbolCount: uniqueSortedValues(categoryRecords.map((record) => record.symbol)).length,
      affectedSymbols: uniqueSortedValues(categoryRecords.map((record) => record.symbol)),
      category,
      examples: uniqueExamples(categoryRecords.map((record) => record.example)),
      rowCount: uniqueSortedValues(categoryRecords.map((record) => record.itemId)).length,
    } satisfies DeciderDataGapCategorySummary;
  })
    .filter((summary): summary is DeciderDataGapCategorySummary => summary !== null)
    .sort((left, right) => {
      if (right.rowCount !== left.rowCount) return right.rowCount - left.rowCount;
      if (right.affectedSymbolCount !== left.affectedSymbolCount) return right.affectedSymbolCount - left.affectedSymbolCount;
      return getCategoryRank(left.category) - getCategoryRank(right.category);
    });
}

export function buildDeciderDataGapSymbolSummaries(records: DeciderDataGapRecord[]) {
  const symbols = uniqueSortedValues(records.map((record) => record.symbol));

  return symbols.map((symbol) => {
    const symbolRecords = records.filter((record) => record.symbol === symbol);
    const categories = [...new Set(symbolRecords.map((record) => record.category))].sort(
      (left, right) => getCategoryRank(left) - getCategoryRank(right),
    );

    return {
      affectedAgentCount: uniqueSortedValues(symbolRecords.map((record) => record.agentName)).length,
      affectedAgents: uniqueSortedValues(symbolRecords.map((record) => record.agentName)),
      categories,
      companyName: symbolRecords.find((record) => record.companyName)?.companyName ?? null,
      examples: uniqueExamples(symbolRecords.map((record) => record.example)),
      repeatedGapCount: symbolRecords.length,
      symbol,
    } satisfies DeciderDataGapSymbolSummary;
  }).sort((left, right) => {
    if (right.repeatedGapCount !== left.repeatedGapCount) return right.repeatedGapCount - left.repeatedGapCount;
    return left.symbol.localeCompare(right.symbol, "en");
  });
}

function getItemsMarketDate(items: SignalDeciderFeedbackItem[]) {
  return items.find((item) => hasTextValue(item.marketDate))?.marketDate ?? null;
}

export function buildDeciderDataGapReport({
  items,
  previousItems,
  topCategoryLimit = 3,
}: {
  items: SignalDeciderFeedbackItem[];
  previousItems?: SignalDeciderFeedbackItem[] | null;
  topCategoryLimit?: number;
}): DeciderDataGapReport {
  const records = buildDeciderDataGapRecords(items);
  const categorySummaries = buildDeciderDataGapCategorySummaries(records);
  const symbolSummaries = buildDeciderDataGapSymbolSummaries(records);
  const rowsWithDataGaps = uniqueSortedValues(records.map((record) => record.itemId)).length;
  const previousRecords = previousItems ? buildDeciderDataGapRecords(previousItems) : [];
  const previousRowsWithDataGaps = uniqueSortedValues(previousRecords.map((record) => record.itemId)).length;
  const previousMarketDate = previousItems ? getItemsMarketDate(previousItems) : null;

  return {
    categorySummaries,
    gapRowRatio: items.length > 0 ? rowsWithDataGaps / items.length : 0,
    records,
    rowsWithDataGaps,
    symbolSummaries,
    topCategories: categorySummaries.slice(0, topCategoryLimit),
    totalFeedbackRows: items.length,
    trend:
      previousItems && previousMarketDate
        ? {
            currentRowsWithDataGaps: rowsWithDataGaps,
            deltaRowsWithDataGaps: rowsWithDataGaps - previousRowsWithDataGaps,
            previousMarketDate,
            previousRowsWithDataGaps,
          }
        : null,
  };
}

export function filterDeciderDataGapRecords({
  category,
  records,
  symbol,
}: {
  category?: DeciderDataGapCategory | "all" | null;
  records: DeciderDataGapRecord[];
  symbol?: string | "all" | null;
}) {
  return records.filter((record) => {
    const matchesCategory = !category || category === "all" || record.category === category;
    const matchesSymbol = !symbol || symbol === "all" || record.symbol === symbol;
    return matchesCategory && matchesSymbol;
  });
}

export function resolveDeciderDataGapDisplayState({
  filteredRecords,
  report,
}: {
  filteredRecords: DeciderDataGapRecord[];
  report: DeciderDataGapReport;
}): DeciderDataGapDisplayState {
  if (report.totalFeedbackRows <= 0) return "no-feedback";
  if (report.rowsWithDataGaps <= 0) return "no-data-gaps";
  if (filteredRecords.length <= 0) return "no-filtered-gaps";
  return "has-data-gaps";
}

export function buildSignalDeciderFeedbackSummary({
  currentMarketDate,
  feedback,
  isLatestCompletedFallback = false,
  marketDate,
  previewLimit = 3,
  progress,
  statusOverride,
}: {
  currentMarketDate?: string | null | undefined;
  feedback: AgentFeedbackListResponseDto | null | undefined;
  isLatestCompletedFallback?: boolean;
  marketDate: string | null | undefined;
  previewLimit?: number;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
  statusOverride?: SignalDeciderFeedbackStatus;
}): SignalDeciderFeedbackSummaryModel {
  return buildDeciderFeedbackSummary({
    agentName: SIGNAL_DECIDER_AGENT_NAME,
    currentMarketDate,
    feedback,
    isLatestCompletedFallback,
    marketDate,
    previewLimit,
    progress,
    statusOverride,
  });
}

export function buildDeciderFeedbackSummary({
  agentName = SIGNAL_DECIDER_AGENT_NAME,
  currentMarketDate,
  feedback,
  isLatestCompletedFallback = false,
  marketDate,
  previewLimit = 3,
  progress,
  statusOverride,
}: {
  agentName?: string | null;
  currentMarketDate?: string | null | undefined;
  feedback: AgentFeedbackListResponseDto | null | undefined;
  isLatestCompletedFallback?: boolean;
  marketDate: string | null | undefined;
  previewLimit?: number;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
  statusOverride?: SignalDeciderFeedbackStatus;
}): SignalDeciderFeedbackSummaryModel {
  const resolvedAgentName = resolveDeciderAgentName(agentName);
  const evaluationReferenceDate = normalizeMarketDate(currentMarketDate);
  const items = normalizeDeciderFeedbackItems(feedback, {
    agentName: resolvedAgentName,
    evaluationReferenceDate,
  });
  const roleSnapshot = isLatestCompletedFallback ? null : getDeciderRoleSnapshot(progress, resolvedAgentName);
  const status = statusOverride ?? resolveDeciderFeedbackStatus({ agentName: resolvedAgentName, feedback, progress });
  const resolvedMarketDate =
    normalizeMarketDate(feedback?.request?.market_date) ??
    normalizeMarketDate(progress?.request?.market_date) ??
    normalizeMarketDate(marketDate);
  const resolvedCurrentMarketDate =
    normalizeMarketDate(currentMarketDate) ?? normalizeMarketDate(progress?.request?.market_date) ?? null;
  const actionCounts = items.reduce<Record<SignalDeciderAction, number>>(
    (counts, item) => {
      counts[item.action] += 1;
      return counts;
    },
    { buy: 0, wait: 0, reject: 0, watch_for_trigger: 0, avoid_chase: 0, unknown: 0 },
  );

  return {
    actionCounts,
    completedCount: roleSnapshot?.completedCount ?? null,
    currentMarketDate: resolvedCurrentMarketDate,
    detailHref:
      resolvedAgentName === SIGNAL_DECIDER_AGENT_NAME
        ? buildSignalDeciderFeedbackHref(resolvedMarketDate)
        : buildDeciderFeedbackHref({ agentName: resolvedAgentName, marketDate: resolvedMarketDate }),
    errorCount: roleSnapshot?.errorCount ?? null,
    isLatestCompletedFallback,
    items,
    marketDate: resolvedMarketDate,
    previewItems: items.slice(0, previewLimit),
    requestedCount: roleSnapshot?.requestedCount ?? null,
    resultCount: items.length,
    runId: progress?.summary?.run_id ?? items[0]?.runId ?? null,
    status,
  };
}
