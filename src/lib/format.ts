export const formatPrice = (price: number) =>
  price.toLocaleString(undefined, {
    minimumFractionDigits: price >= 1000 ? 0 : 2,
    maximumFractionDigits: price >= 1000 ? 0 : 2,
  });

export const formatChange = (change: number) => `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;

const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export const formatTurnover = (turnover: number, currencySymbol = "₩") =>
  `${currencySymbol}${Math.abs(turnover) < 1000 ? turnover.toLocaleString() : compactNumberFormatter.format(turnover)}`;

export function formatDisplayTimestamp(value?: string | null, fallback = "-") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} : ${hours}:${minutes}:${seconds}`;
}
