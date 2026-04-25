import assert from "node:assert/strict";
import test from "node:test";

import type { EodFreshnessResponseDto } from "@/types/trading-api";

import {
  getLatestActionMarketDate,
  getLatestPriceTradeDate,
  getLatestTechnicalMarketDate,
} from "./eod-freshness-latest";

test("prefers stage-specific latest dates over aggregate summary fallback", () => {
  const freshness: EodFreshnessResponseDto = {
    today: null,
    latest: {
      summary: {
        trade_date: "2026-04-23",
      },
      stages: {
        price: {
          summary: {
            price_trade_date: "2026-04-24",
          },
        },
        technical: {
          summary: {
            market_date: "2026-04-22",
          },
        },
        action_summary: {
          summary: {
            market_date: "2026-04-21",
          },
        },
      },
    },
  };

  assert.equal(getLatestPriceTradeDate(freshness), "2026-04-24");
  assert.equal(getLatestTechnicalMarketDate(freshness), "2026-04-22");
  assert.equal(getLatestActionMarketDate(freshness), "2026-04-21");
});

test("prefers flat latest stage dates when both flat and nested payloads exist", () => {
  const freshness: EodFreshnessResponseDto = {
    today: null,
    latest: {
      trade_date: "2026-04-20",
      price_trade_date: "2026-04-24",
      technical_market_date: "2026-04-23",
      action_market_date: "2026-04-22",
      summary: {
        trade_date: "2026-04-19",
      },
      stage_details: {
        price: {
          market_date: "2026-04-18",
        },
        technical_snapshots: {
          market_date: "2026-04-17",
        },
        action: {
          market_date: "2026-04-16",
        },
      },
    },
  };

  assert.equal(getLatestPriceTradeDate(freshness), "2026-04-24");
  assert.equal(getLatestTechnicalMarketDate(freshness), "2026-04-23");
  assert.equal(getLatestActionMarketDate(freshness), "2026-04-22");
});
