import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  AgentFeedbackStoredItemDto,
  AgentFeedbackStoredPayloadDto,
} from "@/types/trading-api";

export const SIGNAL_DECIDER_AGENT_NAME = "signal-decider";
export const SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH = "/api/trading/agent-context/feedback";
export const SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH = "/agent-context/feedback";
export const SIGNAL_DECIDER_FEEDBACK_REVIEW_DATE_UPSTREAM_PATH = "/agent-context/feedback/review";
export const SIGNAL_DECIDER_CALENDAR_SUMMARY_UPSTREAM_PATH = "/agent-context/feedback/calendar";
export const SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT = 200;
export const SIGNAL_DECIDER_FEEDBACK_REVIEW_DATE_CLIENT_PATH = "/api/trading/agent-context/feedback/review";
export const SIGNAL_DECIDER_CALENDAR_SUMMARY_CLIENT_PATH = "/api/trading/agent-context/feedback/calendar";

export type SignalDeciderFeedbackStatus = "waiting" | "running" | "partial" | "completed" | "needs-review";
export type SignalDeciderCalendarStatus = "waiting" | "running" | "partial" | "completed" | "needs-review";

export type SignalDeciderAction = "buy" | "wait" | "reject" | "unknown";

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

export type SignalDeciderTraceEntry = {
  label: string;
  value: string | null;
  tone: SignalDeciderQualityTone | null;
};

export type SignalDeciderFeedbackItem = {
  id: string;
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
  riskFlags: string[];
  targetPrice: number | null;
  stopLossPrice: number | null;
  expectedReturnPct: number | null;
  entryPriceBasis: string | null;
  suggestedHoldingPeriod: string | null;
  policyVersion: string | null;
  qualityVerdict: string | null;
  qualityReason: string | null;
  qualityTag: SignalDeciderQualityTag | null;
  reviewConclusion: string | null;
  pathOutcome: SignalDeciderPathOutcome | null;
  intradayPathResult: string | null;
  outcomeHorizons: SignalDeciderOutcomeHorizon[];
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

function normalizeMarketDate(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function normalizeAction(value: unknown): SignalDeciderAction {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "buy" || normalized === "wait" || normalized === "reject") return normalized;
  if (normalized === "hold" || normalized === "watch" || normalized === "watchlist") return "wait";
  if (normalized === "avoid" || normalized === "skip") return "reject";
  return "unknown";
}

function resolveDecisionActions(payload: AgentFeedbackStoredPayloadDto) {
  const preferredAction = normalizeAction(payload.preferred_action);
  const nextDayOpenAction = normalizeAction(payload.next_day_open_action);
  const action = nextDayOpenAction !== "unknown" ? nextDayOpenAction : preferredAction;

  return {
    action,
    preferredAction,
    nextDayOpenAction,
  };
}

export function formatSignalDeciderActionLabel(action: SignalDeciderAction) {
  if (action === "unknown") return "Unknown";
  return `${action.slice(0, 1).toUpperCase()}${action.slice(1)}`;
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
    normalizedResult.includes("pending") ||
    normalizedResult.includes("not_hit") ||
    normalizedResult.includes("neither")
  ) {
    return buildPathOutcome("unresolved", detail);
  }

  return rawResult ? buildPathOutcome("ambiguous", detail) : null;
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

function compareSignalDeciderItems(left: SignalDeciderFeedbackItem, right: SignalDeciderFeedbackItem) {
  const priority: Record<SignalDeciderAction, number> = {
    buy: 0,
    reject: 1,
    wait: 2,
    unknown: 3,
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
  const params = new URLSearchParams({
    market_date: marketDate,
    agent_name: SIGNAL_DECIDER_AGENT_NAME,
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
  const resolvedMarketDate = normalizeMarketDate(marketDate);
  if (!resolvedMarketDate) return null;

  return buildSignalDeciderFeedbackPath({
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
  if (!hasTextValue(marketDate)) return "/dashboard/signal-decider-feedback";
  const params = new URLSearchParams({ marketDate: marketDate.trim() });
  return `/dashboard/signal-decider-feedback?${params.toString()}`;
}

export function normalizeSignalDeciderFeedbackItems(
  response: AgentFeedbackListResponseDto | null | undefined,
): SignalDeciderFeedbackItem[] {
  const items = response?.items ?? [];

  return items
    .map((item) => {
      const payload = getPayload(item);
      const symbol = getStringValue(payload, ["symbol"]) ?? item.symbol;
      const { action, nextDayOpenAction, preferredAction } = resolveDecisionActions(payload);
      const context = isRecord(item.context) ? item.context : null;
      const details = isRecord(payload.details) ? payload.details : null;
      const itemDetails = isRecord(item.details) ? item.details : null;
      const decisionSupport = getRecordValue(details, ["decision_support", "decisionSupport"]);
      const payloadTraceability = isRecord(payload.traceability) ? payload.traceability : null;
      const rootSources = [payload, details, decisionSupport, itemDetails];
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
      const policyRecord = getFirstRecordFromSources(rootSources, ["policy", "decision_policy", "ruleset"]);
      const qualitySources = [...rootSources, evaluationRecord, outcomeRecord];
      const quality = normalizeQualityTag({ action, sources: qualitySources });
      const outcomeHorizons = getValuesFromSources([...rootSources, evaluationRecord, outcomeRecord], [
        "realized_results",
        "realized_outcomes",
        "outcome_horizons",
        "outcomes",
        "horizon_results",
        "result_by_horizon",
        "horizons",
        "results",
      ]).flatMap(normalizeOutcomeHorizons);
      const pathOutcome = normalizePathOutcome([...rootSources, evaluationRecord, outcomeRecord]);
      const intradayPathResult = getStringFromSources([...rootSources, evaluationRecord, outcomeRecord], [
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
        sources: [...rootSources, evaluationRecord, outcomeRecord],
      });
      const factorAttributions = getValuesFromSources([...rootSources, evaluationRecord], [
        "factors",
        "factor_attribution",
        "factor_attributions",
        "factor_scores",
        "factor_contributions",
        "attribution",
      ]).flatMap(normalizeTraceEntries);
      const gateResults = getValuesFromSources([...rootSources, evaluationRecord], [
        "gates",
        "gate_results",
        "gate_checks",
        "decision_gates",
        "failed_gates",
        "passed_gates",
      ]).flatMap(normalizeTraceEntries);
      const upstreamEvidence = getValuesFromSources(rootSources, [
        "upstream_evidence",
        "supporting_evidence",
        "evidence",
        "references",
        "source_evidence",
      ]).flatMap(normalizeTraceEntries);
      const traceability = getValuesFromSources([...rootSources, payloadTraceability], [
        "traceability",
        "trace",
        "decision_trace",
        "lineage",
      ]).flatMap(normalizeTraceEntries);
      const marketDate =
        normalizeMarketDate(getStringValue(payload, ["market_date"])) ??
        normalizeMarketDate(item.market_date) ??
        response?.request?.market_date ??
        "";

      return {
        id: String(item.id),
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
          getStringValue(payload, ["thesis_summary", "summary"]) ??
          getStringValue(decisionSupport, ["thesis_summary", "summary"]),
        riskFlags: getRiskFlags(payload),
        targetPrice: toFiniteNumber(payload.target_price ?? decisionSupport?.target_price),
        stopLossPrice: toFiniteNumber(payload.stop_loss_price ?? decisionSupport?.stop_loss_price),
        expectedReturnPct: toFiniteNumber(payload.expected_return_pct ?? decisionSupport?.expected_return_pct),
        entryPriceBasis: getStringValue(payload, ["entry_price_basis"]) ?? getStringValue(decisionSupport, ["entry_price_basis"]),
        suggestedHoldingPeriod:
          getStringValue(payload, ["suggested_holding_period"]) ??
          getStringValue(decisionSupport, ["suggested_holding_period"]),
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
        outcomeHorizons,
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

function getSignalDeciderRoleSnapshot(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
): SignalDeciderRoleSnapshot | null {
  const roles = progress?.result?.roles;
  if (!roles) return null;

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
      if (normalizeRole(role) === SIGNAL_DECIDER_AGENT_NAME) return readSnapshot(item);
    }
    return null;
  }

  if (!isRecord(roles)) return null;
  return readSnapshot(roles[SIGNAL_DECIDER_AGENT_NAME]);
}

export function resolveSignalDeciderFeedbackResultLimit(
  progress: AgentFeedbackProgressResponseDto | null | undefined,
) {
  const roleSnapshot = getSignalDeciderRoleSnapshot(progress);
  const requestedLimit = Math.max(roleSnapshot?.completedCount ?? 0, roleSnapshot?.requestedCount ?? 0);
  if (requestedLimit <= 0) return SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT;
  return Math.min(SIGNAL_DECIDER_FEEDBACK_MAX_RESULT_LIMIT, Math.ceil(requestedLimit));
}

function getSignalDeciderRoleProgressStatus(progress: AgentFeedbackProgressResponseDto | null | undefined) {
  const progressRecord = isRecord(progress) ? (progress as Record<string, unknown>) : null;
  const summaryRecord = isRecord(progressRecord?.summary)
    ? (progressRecord.summary as Record<string, unknown>)
    : null;
  const sources = [
    progressRecord?.role_progress,
    progressRecord?.roles,
    summaryRecord?.role_progress,
    summaryRecord?.roles,
    summaryRecord?.role_statuses,
  ];

  for (const source of sources) {
    const candidate = Array.isArray(source)
      ? source.find((item) => isRecord(item) && normalizeRole(getStringValue(item, ["role", "agent", "name", "label"])) === SIGNAL_DECIDER_AGENT_NAME)
      : isRecord(source)
        ? source[SIGNAL_DECIDER_AGENT_NAME]
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
  const items = normalizeSignalDeciderFeedbackItems(feedback);
  const rowCount = items.length;
  const roleSnapshot = getSignalDeciderRoleSnapshot(progress);
  const roleProgressStatus = getSignalDeciderRoleProgressStatus(progress);
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
    currentRole === SIGNAL_DECIDER_AGENT_NAME ||
    remainingRoles.includes(SIGNAL_DECIDER_AGENT_NAME) ||
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
  const items = normalizeSignalDeciderFeedbackItems(feedback);
  const roleSnapshot = isLatestCompletedFallback ? null : getSignalDeciderRoleSnapshot(progress);
  const status = statusOverride ?? resolveSignalDeciderFeedbackStatus({ feedback, progress });
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
    { buy: 0, wait: 0, reject: 0, unknown: 0 },
  );

  return {
    actionCounts,
    completedCount: roleSnapshot?.completedCount ?? null,
    currentMarketDate: resolvedCurrentMarketDate,
    detailHref: buildSignalDeciderFeedbackHref(resolvedMarketDate),
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
