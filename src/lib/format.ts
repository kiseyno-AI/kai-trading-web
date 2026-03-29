export const formatPrice = (price: number) =>
  price.toLocaleString(undefined, {
    minimumFractionDigits: price >= 1000 ? 0 : 2,
    maximumFractionDigits: price >= 1000 ? 0 : 2,
  });

export const formatChange = (change: number) => `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
