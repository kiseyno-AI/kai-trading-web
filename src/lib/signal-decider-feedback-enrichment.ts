import { fetchTradingUpstreamJson } from "@/lib/trading-upstream";
import type { AgentFeedbackListResponseDto } from "@/types/trading-api";
import type { SignalDeciderReviewDateResponse } from "@/lib/signal-decider-feedback";

type UnknownRecord = Record<string, unknown>;

const COMPANY_NAME_KEYS = [
  "company_name",
  "companyName",
  "name_ko",
  "display_name",
  "name",
  "name_en",
  "corp_name",
] as const;

type SymbolNameResolver = (symbol: string) => Promise<string | null>;

export const SIGNAL_DECIDER_FEEDBACK_SYMBOL_ENRICHMENT_DEFAULT_SEARCH_LIMIT = 20;
export const SIGNAL_DECIDER_FEEDBACK_SYMBOL_ENRICHMENT_DEFAULT_CONCURRENCY = 6;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSymbolCode(value: string) {
  return value.trim().toUpperCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSymbolLikeName(symbol: string, value: string) {
  const normalizedSymbol = normalizeSymbolCode(symbol);
  const normalizedValue = value.trim().toUpperCase();
  const escapedSymbol = escapeRegExp(normalizedSymbol);
  return (
    normalizedValue === normalizedSymbol ||
    new RegExp(`^${escapedSymbol}\\s*\\(${escapedSymbol}\\)$`, "i").test(normalizedValue)
  );
}

function getStringValue(record: UnknownRecord | null | undefined, key: string) {
  const value = record?.[key];
  return isText(value) ? value.trim() : null;
}

function getRecordValue(record: UnknownRecord | null | undefined, keys: string[]) {
  let current: UnknownRecord | unknown = record;

  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return isRecord(current) ? current : null;
}

function getUsableCompanyName(symbol: string, values: Array<string | null | undefined>) {
  for (const value of values) {
    if (isText(value) && !isSymbolLikeName(symbol, value)) return value;
  }
  return null;
}

function collectCompanyNamesFromSources(symbol: string, sources: UnknownRecord[]) {
  const candidateValues = sources.flatMap((source) => COMPANY_NAME_KEYS.map((key) => getStringValue(source, key)));
  return getUsableCompanyName(symbol, candidateValues);
}

function injectCompanyNameIntoRecord(record: UnknownRecord, symbol: string, name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return record;

  let changed = false;
  const nextRecord = { ...record };

  for (const key of COMPANY_NAME_KEYS) {
    const existing = getStringValue(nextRecord, key);
    if (!isText(existing) || isSymbolLikeName(symbol, existing)) {
      if (nextRecord[key] !== trimmedName) {
        nextRecord[key] = trimmedName;
      }
      changed = true;
    }
  }

  return changed ? nextRecord : record;
}

function collectFeedbackContextCandidates(context: UnknownRecord | null | undefined) {
  if (!context) return [];
  const symbolDayContext = getRecordValue(context, ["symbol_day_context", "symbolDayContext"]);
  const contextCompany = getRecordValue(context, ["company"]);
  const nestedCompany = getRecordValue(symbolDayContext, ["company"]);

  return [context, symbolDayContext, contextCompany, nestedCompany].filter((value): value is UnknownRecord =>
    isRecord(value),
  );
}

function getFeedbackItemSymbol(item: AgentFeedbackListResponseDto["items"][number]) {
  return normalizeSymbolCode(item.symbol);
}

function resolveFeedbackItemCompanyName(item: AgentFeedbackListResponseDto["items"][number]) {
  const symbol = getFeedbackItemSymbol(item);
  const payload = isRecord(item.normalized_feedback)
    ? item.normalized_feedback
    : isRecord(item.feedback)
      ? item.feedback
      : null;
  const context = isRecord(item.context) ? item.context : null;
  const sources = [
    item.summary,
    payload,
    context,
    ...collectFeedbackContextCandidates(context),
  ].filter((value): value is UnknownRecord => isRecord(value));

  return collectCompanyNamesFromSources(symbol, sources);
}

function injectCompanyNameIntoFeedbackItem(
  item: AgentFeedbackListResponseDto["items"][number],
  symbol: string,
  name: string,
) {
  const existingSummary = isRecord(item.summary) ? item.summary : null;
  const injectedSummary = existingSummary ? injectCompanyNameIntoRecord(existingSummary, symbol, name) : null;
  const hasNormalizedFeedback = isRecord(item.normalized_feedback);
  const hasFeedback = isRecord(item.feedback);

  const existingPayload = hasNormalizedFeedback ? item.normalized_feedback : hasFeedback ? item.feedback : null;
  const injectedPayload = existingPayload ? injectCompanyNameIntoRecord(existingPayload, symbol, name) : null;

  const context = isRecord(item.context) ? item.context : null;
  const contextSymbolDay = getRecordValue(context, ["symbol_day_context", "symbolDayContext"]);
  const contextCompany = getRecordValue(context, ["company"]);
  const hasContextCompany = isRecord(contextSymbolDay) || isRecord(contextCompany);
  const contextSymbolDayKey =
    isRecord(context?.symbol_day_context) ? "symbol_day_context" : isRecord(context?.symbolDayContext) ? "symbolDayContext" : null;
  const contextCompanyInject = contextCompany ? injectCompanyNameIntoRecord(contextCompany, symbol, name) : null;

  const injectedContext = context
    ? {
        ...context,
        ...(contextSymbolDayKey ? { [contextSymbolDayKey]: contextSymbolDay ? injectCompanyNameIntoRecord(contextSymbolDay, symbol, name) : contextCompanyInject } : {}),
        ...(hasContextCompany && !contextSymbolDayKey ? { company: contextCompanyInject ?? contextCompany } : {}),
      }
    : null;

  return {
    ...item,
    summary: existingSummary && injectedSummary ? injectedSummary : isRecord(item.summary) ? item.summary : { company_name: name },
    feedback: hasNormalizedFeedback ? item.feedback : hasFeedback ? injectedPayload : item.feedback,
    normalized_feedback: hasNormalizedFeedback ? injectedPayload : item.normalized_feedback,
    context: injectedContext,
  } satisfies AgentFeedbackListResponseDto["items"][number];
}

function getReviewDateItemSymbol(item: SignalDeciderReviewDateResponse["items"][number]) {
  if (isText(item.symbol)) return normalizeSymbolCode(item.symbol);

  const payload = isRecord(item.feedback) ? item.feedback : isRecord(item.summary) ? item.summary : null;
  const symbolValue = getStringValue(payload, "symbol");
  const snapshotSymbol = getStringValue(payload, "snapshot_symbol");

  return isText(symbolValue) ? normalizeSymbolCode(symbolValue) : isText(snapshotSymbol) ? normalizeSymbolCode(snapshotSymbol) : null;
}

function getReviewDateItemContextCandidates(item: SignalDeciderReviewDateResponse["items"][number]) {
  const itemRecord = item as UnknownRecord;
  const context = getRecordValue(itemRecord, ["context"]);
  const symbolDayContext = getRecordValue(context, ["symbol_day_context", "symbolDayContext"]);
  const contextCompany = getRecordValue(context, ["company"]);
  const nestedCompany = getRecordValue(symbolDayContext, ["company"]);

  return [itemRecord, context, symbolDayContext, contextCompany, nestedCompany].filter(
    (value): value is UnknownRecord => isRecord(value),
  );
}

function resolveReviewDateItemCompanyName(item: SignalDeciderReviewDateResponse["items"][number], symbol: string) {
  const sources = [
    item.summary,
    item.feedback,
    item.normalized_feedback,
    item.review,
    item.details,
    item.decision as unknown,
    ...getReviewDateItemContextCandidates(item),
  ].filter((value): value is UnknownRecord => isRecord(value));

  return collectCompanyNamesFromSources(symbol, sources);
}

function injectCompanyNameIntoReviewItem(
  item: SignalDeciderReviewDateResponse["items"][number],
  symbol: string,
  name: string,
) {
  const itemRecord = item as UnknownRecord;

  const injectedSummary = isRecord(item.summary) ? injectCompanyNameIntoRecord(item.summary, symbol, name) : item.summary;
  const injectedDecision = isRecord(item.decision as UnknownRecord)
    ? injectCompanyNameIntoRecord(item.decision as UnknownRecord, symbol, name)
    : item.decision;
  const injectedFeedback = isRecord(item.feedback as UnknownRecord)
    ? injectCompanyNameIntoRecord(item.feedback as UnknownRecord, symbol, name)
    : item.feedback;
  const injectedNormalized = isRecord(item.normalized_feedback)
    ? injectCompanyNameIntoRecord(item.normalized_feedback, symbol, name)
    : item.normalized_feedback;
  const injectedReview = isRecord(item.review) ? injectCompanyNameIntoRecord(item.review, symbol, name) : item.review;
  const injectedDetails = isRecord(item.details) ? injectCompanyNameIntoRecord(item.details, symbol, name) : item.details;

  return {
    ...(injectCompanyNameIntoRecord(itemRecord, symbol, name) as SignalDeciderReviewDateResponse["items"][number]),
    summary: injectedSummary,
    decision: injectedDecision as SignalDeciderReviewDateResponse["items"][number]["decision"],
    feedback: injectedFeedback,
    normalized_feedback: injectedNormalized,
    review: injectedReview,
    details: injectedDetails,
  };
}

async function resolveSymbolNamesWithConcurrency(
  symbols: string[],
  resolveSymbolName: SymbolNameResolver,
  concurrency: number,
) {
  const pending = [...symbols];
  const symbolNameByCode = new Map<string, string>();
  const workerCount = Math.max(1, Math.min(concurrency, pending.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (pending.length > 0) {
      const symbol = pending.shift();
      if (symbol === undefined) return;

      try {
        const resolved = await resolveSymbolName(symbol);
        if (isText(resolved)) {
          symbolNameByCode.set(symbol, resolved);
        }
      } catch {
        // Keep explicit unavailable state when enrichment fails.
      }
    }
  });

  await Promise.all(workers);
  return symbolNameByCode;
}

export async function enrichSignalDeciderFeedbackListWithSymbolMetadata({
  response,
  resolveSymbolName,
  concurrency = SIGNAL_DECIDER_FEEDBACK_SYMBOL_ENRICHMENT_DEFAULT_CONCURRENCY,
}: {
  response: AgentFeedbackListResponseDto;
  resolveSymbolName: SymbolNameResolver;
  concurrency?: number;
}) {
  const symbolsNeedingMetadata = new Set<string>();

  for (const item of response.items) {
    const symbol = getFeedbackItemSymbol(item);
    if (!symbol) continue;
    if (resolveFeedbackItemCompanyName(item)) continue;
    symbolsNeedingMetadata.add(symbol);
  }

  if (symbolsNeedingMetadata.size === 0) {
    return response;
  }

  const symbolNameByCode = await resolveSymbolNamesWithConcurrency(
    [...symbolsNeedingMetadata],
    resolveSymbolName,
    concurrency,
  );

  const enrichedItems = response.items.map((item) => {
    const symbol = getFeedbackItemSymbol(item);
    if (!symbol) return item;

    const resolvedName = symbolNameByCode.get(symbol);
    if (!resolvedName) return item;

    return injectCompanyNameIntoFeedbackItem(item, symbol, resolvedName);
  });

  return {
    ...response,
    items: enrichedItems,
  };
}

export async function enrichSignalDeciderReviewDateResponseWithSymbolMetadata({
  response,
  resolveSymbolName,
  concurrency = SIGNAL_DECIDER_FEEDBACK_SYMBOL_ENRICHMENT_DEFAULT_CONCURRENCY,
}: {
  response: SignalDeciderReviewDateResponse;
  resolveSymbolName: SymbolNameResolver;
  concurrency?: number;
}) {
  const symbolsNeedingMetadata = new Set<string>();

  for (const item of response.items) {
    const symbol = getReviewDateItemSymbol(item);
    if (!symbol) continue;
    if (resolveReviewDateItemCompanyName(item, symbol)) continue;
    symbolsNeedingMetadata.add(symbol);
  }

  if (symbolsNeedingMetadata.size === 0) {
    return response;
  }

  const symbolNameByCode = await resolveSymbolNamesWithConcurrency(
    [...symbolsNeedingMetadata],
    resolveSymbolName,
    concurrency,
  );

  const enrichedItems = response.items.map((item) => {
    const symbol = getReviewDateItemSymbol(item);
    if (!symbol) return item;

    const resolvedName = symbolNameByCode.get(symbol);
    if (!resolvedName) return item;

    return injectCompanyNameIntoReviewItem(item, symbol, resolvedName);
  });

  return {
    ...response,
    items: enrichedItems,
  };
}

type SymbolSearchResponse = {
  items?: unknown;
};

export async function resolveSymbolNameFromSearchEndpoint(
  symbol: string,
  limit = SIGNAL_DECIDER_FEEDBACK_SYMBOL_ENRICHMENT_DEFAULT_SEARCH_LIMIT,
) {
  const normalizedSymbol = normalizeSymbolCode(symbol);

  try {
    const response = await fetchTradingUpstreamJson<SymbolSearchResponse>(
      `/symbols/search?q=${encodeURIComponent(normalizedSymbol)}&limit=${encodeURIComponent(String(limit))}`,
    );

    if (!Array.isArray(response?.items)) return null;

    const symbolEntries = response.items.filter(isRecord);
    const exactMatch = symbolEntries.find((entry) => {
      const candidateSymbol = getStringValue(entry, "symbol");
      return isText(candidateSymbol) && normalizeSymbolCode(candidateSymbol) === normalizedSymbol;
    });
    const symbolCandidate = exactMatch ?? symbolEntries[0];
    if (!symbolCandidate) return null;

    return getUsableCompanyName(
      normalizedSymbol,
      COMPANY_NAME_KEYS.map((key) => getStringValue(symbolCandidate, key)),
    );
  } catch {
    return null;
  }
}
