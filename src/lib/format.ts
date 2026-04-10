const DISPLAY_LOCALE = "ko-KR";
const DISPLAY_TIME_ZONE = "Asia/Seoul";

export const formatPrice = (price?: number | null, fallback = "-") => {
  if (typeof price !== "number") return fallback;
  return price.toLocaleString(DISPLAY_LOCALE, {
    minimumFractionDigits: price >= 1000 ? 0 : 2,
    maximumFractionDigits: price >= 1000 ? 0 : 2,
  });
};

export const formatChange = (change: number) => `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;

const compactNumberFormatter = new Intl.NumberFormat(DISPLAY_LOCALE, {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export const formatTurnover = (turnover?: number | null, currencySymbol = "₩", fallback = "-") => {
  if (typeof turnover !== "number") return fallback;
  return `${currencySymbol}${Math.abs(turnover) < 1000 ? turnover.toLocaleString(DISPLAY_LOCALE) : compactNumberFormatter.format(turnover)}`;
};

export function formatDisplayTimestamp(value?: string | null, fallback = "-") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "00";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  const hours = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minutes = parts.find((part) => part.type === "minute")?.value ?? "00";
  const seconds = parts.find((part) => part.type === "second")?.value ?? "00";

  return `${year}-${month}-${day} : ${hours}:${minutes}:${seconds}`;
}
