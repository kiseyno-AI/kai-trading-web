"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart } from "lightweight-charts";

import { formatPrice } from "@/lib/format";
import type { SymbolPriceBarDto } from "@/types/trading-api";

import styles from "./symbol-detail.module.css";

type Props = {
  symbol: string;
  bars: SymbolPriceBarDto[];
};

export function SymbolHistoryChart({ symbol, bars }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || bars.length === 0) {
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
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.07)" },
      },
      crosshair: {
        vertLine: { color: "rgba(73, 179, 255, 0.24)", labelBackgroundColor: "#102235" },
        horzLine: { color: "rgba(73, 179, 255, 0.24)", labelBackgroundColor: "#102235" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        minBarSpacing: 0.2,
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

    series.setData(
      bars.map((bar) => ({
        time: bar.trade_date,
        open: bar.open_price,
        high: bar.high_price,
        low: bar.low_price,
        close: bar.close_price,
      })),
    );

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [bars, symbol]);

  return (
    <div
      ref={containerRef}
      className={styles.candlestickChart}
      role="img"
      aria-label={`Historical candlestick chart for ${symbol}`}
    />
  );
}
