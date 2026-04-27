"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  TrackingModeExitMode,
  createChart,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";

import { formatPrice } from "@/lib/format";
import type { SymbolPriceBarDto } from "@/types/trading-api";
import { resolveTradeDateFromChartCoordinate } from "@/features/symbol-detail/symbol-history-chart-selection";

import styles from "./symbol-detail.module.css";

type Props = {
  symbol: string;
  bars: SymbolPriceBarDto[];
  initialSelectedBarTradeDate?: string | null;
  onSelectedBarChange?: (bar: SymbolPriceBarDto | null) => void;
};

export function SymbolHistoryChart({ symbol, bars, initialSelectedBarTradeDate, onSelectedBarChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialSelectedBarTradeDateRef = useRef(initialSelectedBarTradeDate);

  const normalizeTradeDate = (time: Time | undefined) => {
    if (!time) return null;
    if (typeof time === "string") return time;
    if (typeof time === "number") return null;
    return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || bars.length === 0) {
      onSelectedBarChange?.(null);
      return;
    }

    const getContainerDimensions = () => ({
      height: Math.max(container.clientHeight, 240),
      width: Math.max(container.clientWidth, 1),
    });
    const initialDimensions = getContainerDimensions();
    const chart = createChart(container, {
      autoSize: false,
      height: initialDimensions.height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(231, 242, 255, 0.78)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.08)" },
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          color: "rgba(73, 179, 255, 0.28)",
          labelBackgroundColor: "#102235",
          width: 1,
        },
        horzLine: {
          color: "rgba(73, 179, 255, 0.18)",
          labelBackgroundColor: "#102235",
          width: 1,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        minBarSpacing: bars.length > 500 ? 3 : 5,
        rightOffset: 4,
      },
      localization: {
        priceFormatter: (value: number) => `KRW ${formatPrice(value)}`,
      },
      width: initialDimensions.width,
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        pinch: true,
        mouseWheel: true,
      },
      trackingMode: {
        exitMode: TrackingModeExitMode.OnNextTap,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#35d07f",
      downColor: "#ff6b7a",
      wickUpColor: "#52e398",
      wickDownColor: "#ff8f9a",
      borderVisible: false,
      priceLineColor: "#8ec5ff",
      lastValueVisible: true,
    });

    const seriesData = bars.map((bar) => ({
      time: bar.trade_date,
      open: bar.open_price,
      high: bar.high_price,
      low: bar.low_price,
      close: bar.close_price,
    }));

    const barByDate = new Map(bars.map((bar) => [bar.trade_date, bar]));
    const initialSelectedBar =
      (initialSelectedBarTradeDateRef.current ? barByDate.get(initialSelectedBarTradeDateRef.current) ?? null : null) ??
      bars[bars.length - 1] ??
      null;

    series.setData(seriesData);
    chart.timeScale().fitContent();
    onSelectedBarChange?.(initialSelectedBar);

    const updateFocusedBar = (tradeDate: string | null) => {
      if (!tradeDate) return;
      onSelectedBarChange?.(barByDate.get(tradeDate) ?? null);
    };

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      updateFocusedBar(normalizeTradeDate(param.time));
    };

    const handleClick = (param: MouseEventParams<Time>) => {
      updateFocusedBar(normalizeTradeDate(param.time));
    };

    const resolveTradeDateFromCoordinate = (coordinate: number) =>
      resolveTradeDateFromChartCoordinate({
        bars,
        coordinate,
        containerWidth: container.clientWidth,
        logicalIndex: chart.timeScale().coordinateToLogical(coordinate),
        timeScaleTradeDate: normalizeTradeDate(chart.timeScale().coordinateToTime(coordinate) ?? undefined),
      });
    const updateFocusedBarFromPointerPosition = (clientX: number) => {
      const rect = container.getBoundingClientRect();
      const coordinate = clientX - rect.left;
      const tradeDate = resolveTradeDateFromCoordinate(coordinate);
      updateFocusedBar(tradeDate);
    };
    const handlePointerMove = (event: PointerEvent) => {
      updateFocusedBarFromPointerPosition(event.clientX);
    };
    const handlePointerDown = (event: PointerEvent) => {
      updateFocusedBarFromPointerPosition(event.clientX);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.subscribeClick(handleClick);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerdown", handlePointerDown);

    const resizeObserver = new ResizeObserver(() => {
      const nextDimensions = getContainerDimensions();
      chart.applyOptions({ width: nextDimensions.width, height: nextDimensions.height });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.unsubscribeClick(handleClick);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerdown", handlePointerDown);
      chart.remove();
    };
  }, [bars, onSelectedBarChange, symbol]);

  return (
    <div
      ref={containerRef}
      className={styles.candlestickChart}
      role="img"
      aria-label={`Historical candlestick chart for ${symbol}`}
    />
  );
}
