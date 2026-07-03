const RAW_UPSTREAM_DIAGNOSTIC_PATTERNS = [
  /\bHTTP\s+\d{3}\b/i,
  /\bTimed out after\b/i,
  /\btrading-core\b/i,
  /\/(?:api\/trading\/)?(?:agent-context|execution|portfolio|scanner|quotes|symbols|market|eod)\b/i,
];

export function isRawUpstreamDiagnosticMessage(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  return RAW_UPSTREAM_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getUserFacingErrorMessage(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return isRawUpstreamDiagnosticMessage(trimmed) ? fallback : trimmed;
}
