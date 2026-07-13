export const PRODUCT_MARKET_TIME_ZONE = "Asia/Seoul";

const ISO_DATE_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

export function getCurrentProductMarketDate(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT_MARKET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function normalizeProductMarketDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return ISO_DATE_PREFIX_PATTERN.exec(trimmed)?.[1] ?? null;
}

export function compareProductMarketDates(left: unknown, right: unknown) {
  const normalizedLeft = normalizeProductMarketDate(left);
  const normalizedRight = normalizeProductMarketDate(right);
  if (!normalizedLeft || !normalizedRight) return null;
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft < normalizedRight ? -1 : 1;
}

export function clampMarketDateToProductDate(
  marketDate: string | null | undefined,
  productMarketDate = getCurrentProductMarketDate(),
) {
  const normalizedMarketDate = normalizeProductMarketDate(marketDate);
  if (!normalizedMarketDate) return null;

  const normalizedProductDate = normalizeProductMarketDate(productMarketDate);
  if (!normalizedProductDate) return normalizedMarketDate;

  return normalizedMarketDate > normalizedProductDate ? normalizedProductDate : normalizedMarketDate;
}

export function isWeekendProductMarketDate(marketDate: string | null | undefined) {
  const normalizedMarketDate = normalizeProductMarketDate(marketDate);
  if (!normalizedMarketDate) return false;

  const [year, month, day] = normalizedMarketDate.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}
