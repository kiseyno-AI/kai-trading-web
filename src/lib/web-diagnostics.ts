export type WebDiagnosticCategory = "http" | "interaction" | "navigation" | "state";

type WebDiagnosticDetails = Record<string, unknown>;

const REDACTED_VALUE = "[redacted]";
const OMITTED_VALUE = "[omitted]";
const MAX_STRING_LENGTH = 180;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;

let diagnosticSequence = 0;

function isDiagnosticsExplicitlyEnabled() {
  return process.env.NEXT_PUBLIC_KAI_WEB_DIAGNOSTICS === "1";
}

export function isWebDiagnosticsEnabled() {
  return process.env.NODE_ENV !== "production" || isDiagnosticsExplicitlyEnabled();
}

function truncateString(value: string, maxLength = MAX_STRING_LENGTH) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}

function isSensitiveKey(key: string) {
  return /authorization|bearer|cookie|password|secret|session|token|api[_-]?key/i.test(key);
}

function isUrlLikeKey(key: string) {
  return /endpoint|from|href|path|route|target|to|url/i.test(key);
}

function getDiagnosticTimerValue() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function getDiagnosticBaseUrl() {
  return typeof window !== "undefined" ? window.location.origin : "http://kai.local";
}

function shouldRenderAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function sanitizeDiagnosticUrl(value: string) {
  try {
    const url = new URL(value, getDiagnosticBaseUrl());
    const safeSearchParams = new URLSearchParams();

    for (const [key, paramValue] of url.searchParams.entries()) {
      safeSearchParams.append(
        key,
        isSensitiveKey(key) ? REDACTED_VALUE : truncateString(paramValue, 80),
      );
    }

    url.search = safeSearchParams.toString();
    const renderedUrl = shouldRenderAbsoluteUrl(value)
      ? `${url.origin}${url.pathname}${url.search}${url.hash}`
      : `${url.pathname}${url.search}${url.hash}`;

    return truncateString(renderedUrl);
  } catch {
    return truncateString(value);
  }
}

function describeDiagnosticError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: truncateString(error.message),
      name: error.name,
    };
  }

  return truncateString(String(error));
}

function sanitizeDiagnosticValue(
  value: unknown,
  key = "",
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (isSensitiveKey(key)) return REDACTED_VALUE;
  if (key === "body" || key === "headers") return OMITTED_VALUE;

  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return isUrlLikeKey(key) ? sanitizeDiagnosticUrl(value) : truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return describeDiagnosticError(value);
  }

  if (Array.isArray(value)) {
    if (depth >= 3) return `[array:${value.length}]`;
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item, index) => sanitizeDiagnosticValue(item, `${key}.${index}`, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    if (depth >= 3) return "[object]";

    const safeObject: WebDiagnosticDetails = {};
    for (const [objectKey, objectValue] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      safeObject[objectKey] = sanitizeDiagnosticValue(objectValue, objectKey, depth + 1, seen);
    }

    return safeObject;
  }

  return truncateString(String(value));
}

export function logWebDiagnostic(
  category: WebDiagnosticCategory,
  action: string,
  details: WebDiagnosticDetails = {},
) {
  if (!isWebDiagnosticsEnabled()) return;

  const payload = sanitizeDiagnosticValue({
    timestamp: new Date().toISOString(),
    category,
    action,
    ...details,
  }) as WebDiagnosticDetails;
  const logger = typeof console.debug === "function" ? console.debug : console.log;

  logger.call(console, `[kai:diagnostics] ${category}:${action}`, payload);
}

export function startWebDiagnosticSpan(
  category: WebDiagnosticCategory,
  action: string,
  details: WebDiagnosticDetails = {},
) {
  diagnosticSequence += 1;
  const diagnosticId = `diag_${Date.now().toString(36)}_${diagnosticSequence.toString(36)}`;
  const startedAt = getDiagnosticTimerValue();

  logWebDiagnostic(category, `${action}:start`, {
    diagnosticId,
    ...details,
  });

  return {
    end(endDetails: WebDiagnosticDetails = {}) {
      logWebDiagnostic(category, `${action}:end`, {
        diagnosticId,
        durationMs: Math.round((getDiagnosticTimerValue() - startedAt) * 10) / 10,
        ...endDetails,
      });
    },
    fail(error: unknown, errorDetails: WebDiagnosticDetails = {}) {
      logWebDiagnostic(category, `${action}:error`, {
        diagnosticId,
        durationMs: Math.round((getDiagnosticTimerValue() - startedAt) * 10) / 10,
        error: describeDiagnosticError(error),
        ...errorDetails,
      });
    },
  };
}
