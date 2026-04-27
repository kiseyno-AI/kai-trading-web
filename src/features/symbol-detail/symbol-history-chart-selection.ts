import type { SymbolPriceBarDto } from "@/types/trading-api";

type TradeDateOnlyBar = Pick<SymbolPriceBarDto, "trade_date">;

type ResolveTradeDateFromChartCoordinateOptions = {
  bars: TradeDateOnlyBar[];
  coordinate: number;
  containerWidth: number;
  logicalIndex: number | null | undefined;
  timeScaleTradeDate: string | null;
};

export function resolveTradeDateFromChartCoordinate({
  bars,
  coordinate,
  containerWidth,
  logicalIndex,
  timeScaleTradeDate,
}: ResolveTradeDateFromChartCoordinateOptions) {
  const lastBarTradeDate = bars[bars.length - 1]?.trade_date ?? null;
  if (!lastBarTradeDate) {
    return null;
  }

  if (typeof logicalIndex === "number" && Number.isFinite(logicalIndex)) {
    const clampedIndex = Math.max(0, Math.min(bars.length - 1, Math.round(logicalIndex)));
    return bars[clampedIndex]?.trade_date ?? lastBarTradeDate;
  }

  if (timeScaleTradeDate) {
    return timeScaleTradeDate;
  }

  if (bars.length === 1) {
    return lastBarTradeDate;
  }

  const clampedRatio = Math.max(0, Math.min(1, coordinate / Math.max(containerWidth, 1)));
  const ratioIndex = Math.max(0, Math.min(bars.length - 1, Math.round(clampedRatio * (bars.length - 1))));
  return bars[ratioIndex]?.trade_date ?? lastBarTradeDate;
}
