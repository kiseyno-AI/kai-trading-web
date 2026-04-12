export const UNKNOWN_SYMBOL_META = "[확인 필요]";

export function getForwardableSymbolMetaSeedValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "-" || trimmed === UNKNOWN_SYMBOL_META) return null;
  return trimmed;
}

export function isPlaceholderSymbolMetaSeed(value: string | null | undefined): boolean {
  return getForwardableSymbolMetaSeedValue(value) === null;
}

export function normalizeSymbolMetaSeedValue(value: string | null | undefined): string {
  return getForwardableSymbolMetaSeedValue(value) ?? UNKNOWN_SYMBOL_META;
}
