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

import styles from "./symbol-detail.module.css";

type Props = {
  symbol: string;
  bars: SymbolPriceBarDto[];
  onSelectedBarChange?: (bar: SymbolPriceBarDto | null) => void;
};

export function SymbolHistoryChart({ symbol, bars, onSelectedBarChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

    const chart = createChart(container, {
      autoSize: true,
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

    series.setData(seriesData);
    chart.timeScale().fitContent();
    onSelectedBarChange?.(bars[bars.length - 1] ?? null);

    const barByDate = new Map(bars.map((bar) => [bar.trade_date, bar]));

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

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.subscribeClick(handleClick);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.unsubscribeClick(handleClick);
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
